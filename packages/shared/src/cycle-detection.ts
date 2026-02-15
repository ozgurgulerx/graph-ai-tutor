import type { EdgeSummary } from "./schemas/api-v1";

export type CycleCheckResult =
  | { wouldCycle: false }
  | { wouldCycle: true; cycleNodeIds: string[] };

/**
 * Check whether adding a PREREQUISITE_OF edge from `fromConceptId` to
 * `toConceptId` would create a cycle in the prerequisite subgraph.
 *
 * Algorithm: build adjacency map from existing PREREQUISITE_OF edges,
 * add candidate edge, then DFS from `toConceptId` to see if
 * `fromConceptId` is reachable — if so, adding from→to creates a cycle.
 */
export function wouldCreatePrereqCycle(params: {
  fromConceptId: string;
  toConceptId: string;
  existingEdges: ReadonlyArray<Pick<EdgeSummary, "fromConceptId" | "toConceptId" | "type">>;
}): CycleCheckResult {
  const { fromConceptId, toConceptId, existingEdges } = params;

  // Trivial self-loop
  if (fromConceptId === toConceptId) {
    return { wouldCycle: true, cycleNodeIds: [fromConceptId] };
  }

  // Build adjacency map from existing PREREQUISITE_OF edges
  const adj = new Map<string, string[]>();

  for (const edge of existingEdges) {
    if (edge.type !== "PREREQUISITE_OF") continue;
    let neighbors = adj.get(edge.fromConceptId);
    if (!neighbors) {
      neighbors = [];
      adj.set(edge.fromConceptId, neighbors);
    }
    neighbors.push(edge.toConceptId);
  }

  // Add candidate edge
  let fromNeighbors = adj.get(fromConceptId);
  if (!fromNeighbors) {
    fromNeighbors = [];
    adj.set(fromConceptId, fromNeighbors);
  }
  fromNeighbors.push(toConceptId);

  // DFS from toConceptId to see if we can reach fromConceptId
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (node === fromConceptId) {
      path.push(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    path.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        if (dfs(next)) return true;
      }
    }

    path.pop();
    return false;
  }

  if (dfs(toConceptId)) {
    return { wouldCycle: true, cycleNodeIds: path };
  }

  return { wouldCycle: false };
}
