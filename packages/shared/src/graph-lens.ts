import type { ConceptSummary, EdgeSummary, LensNodeMetadata, LensSide } from "./schemas/api-v1";
import { getPrereqDirection } from "./edge-semantics";

export type GraphLensInput = {
  centerId: string;
  radius: number;
  edges: ReadonlyArray<Pick<EdgeSummary, "id" | "fromConceptId" | "toConceptId" | "type">>;
  nodes: ReadonlyArray<Pick<ConceptSummary, "id" | "title">>;
  edgeTypeFilter: string[];
};

export type GraphLensResult = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  metadata: LensNodeMetadata[];
  warnings: string[];
};

export function computeGraphLens(input: GraphLensInput): GraphLensResult {
  const { centerId, radius, edges, nodes, edgeTypeFilter } = input;
  const warnings: string[] = [];

  // Build adjacency maps from PREREQUISITE_OF edges
  const prereqsOf = new Map<string, Set<string>>(); // prereqsOf[nodeId] → set of prereq nodes
  const dependentsOf = new Map<string, Set<string>>(); // dependentsOf[nodeId] → set of dependent nodes
  const edgeIndex = new Map<string, Pick<EdgeSummary, "id" | "fromConceptId" | "toConceptId" | "type">[]>();

  for (const edge of edges) {
    const dir = getPrereqDirection(edge);
    if (!dir) continue;

    // prereqsOf: who are the prereqs of this dependent?
    if (!prereqsOf.has(dir.dependentId)) prereqsOf.set(dir.dependentId, new Set());
    prereqsOf.get(dir.dependentId)!.add(dir.prereqId);

    // dependentsOf: who depends on this prereq?
    if (!dependentsOf.has(dir.prereqId)) dependentsOf.set(dir.prereqId, new Set());
    dependentsOf.get(dir.prereqId)!.add(dir.dependentId);
  }

  // Index all edges by both endpoints for edge collection phase
  for (const edge of edges) {
    for (const endpoint of [edge.fromConceptId, edge.toConceptId]) {
      if (!edgeIndex.has(endpoint)) edgeIndex.set(endpoint, []);
      edgeIndex.get(endpoint)!.push(edge);
    }
  }

  // Track node assignments: nodeId → { side, depth }
  const nodeAssignment = new Map<string, { side: LensSide; depth: number }>();
  nodeAssignment.set(centerId, { side: "center", depth: 0 });

  let cycleDetected = false;

  // BFS backward through prereqsOf (find prerequisites of center)
  {
    let frontier = new Set<string>([centerId]);
    for (let depth = 1; depth <= radius; depth++) {
      const next = new Set<string>();
      for (const nodeId of frontier) {
        const prereqs = prereqsOf.get(nodeId);
        if (!prereqs) continue;
        for (const prereqId of prereqs) {
          if (prereqId === centerId) {
            cycleDetected = true;
            continue;
          }
          if (nodeAssignment.has(prereqId)) continue;
          nodeAssignment.set(prereqId, { side: "prereq", depth });
          next.add(prereqId);
        }
      }
      frontier = next;
    }
  }

  // BFS forward through dependentsOf (find dependents of center)
  {
    let frontier = new Set<string>([centerId]);
    for (let depth = 1; depth <= radius; depth++) {
      const next = new Set<string>();
      for (const nodeId of frontier) {
        const deps = dependentsOf.get(nodeId);
        if (!deps) continue;
        for (const depId of deps) {
          if (depId === centerId) {
            cycleDetected = true;
            continue;
          }
          if (nodeAssignment.has(depId)) {
            // Forward BFS hit a node already claimed by backward BFS → cycle
            if (nodeAssignment.get(depId)!.side === "prereq") {
              cycleDetected = true;
            }
            continue;
          }
          nodeAssignment.set(depId, { side: "dependent", depth });
          next.add(depId);
        }
      }
      frontier = next;
    }
  }

  if (cycleDetected) {
    warnings.push("cycle_detected");
  }

  // Collect node IDs
  const nodeIds = new Set(nodeAssignment.keys());

  // Edge collection
  const edgeTypeFilterSet = new Set(edgeTypeFilter);
  const edgeIds = new Set<string>();

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromConceptId) || !nodeIds.has(edge.toConceptId)) continue;

    if (edge.type === "PREREQUISITE_OF") {
      // Always include structural backbone
      edgeIds.add(edge.id);
    } else if (edgeTypeFilterSet.size === 0 || edgeTypeFilterSet.has(edge.type)) {
      // Secondary edges: include if filter is empty (all) or matches
      edgeIds.add(edge.id);
    }
  }

  // Build title lookup for rank sorting
  const titleById = new Map<string, string>();
  for (const node of nodes) {
    titleById.set(node.id, node.title);
  }

  // Compute rank: within each (side, depth) group, sort alphabetically by title
  const groups = new Map<string, string[]>();
  for (const [id, assignment] of nodeAssignment) {
    const key = `${assignment.side}:${assignment.depth}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }

  const rankById = new Map<string, number>();
  for (const members of groups.values()) {
    members.sort((a, b) => {
      const titleA = (titleById.get(a) ?? a).toLowerCase();
      const titleB = (titleById.get(b) ?? b).toLowerCase();
      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;
      return a.localeCompare(b);
    });
    for (let i = 0; i < members.length; i++) {
      rankById.set(members[i], i);
    }
  }

  // Build metadata array
  const metadata: LensNodeMetadata[] = [];
  for (const [id, assignment] of nodeAssignment) {
    metadata.push({
      id,
      side: assignment.side,
      depth: assignment.depth,
      rank: rankById.get(id) ?? 0
    });
  }

  return { nodeIds, edgeIds, metadata, warnings };
}
