import type { ConceptSummary, EdgeSummary, EdgeType } from "@graph-ai-tutor/shared";

// --- Types ---

export type TreeNode = {
  concept: ConceptSummary;
  children: TreeNode[];
  depth: number;
};

export type OrphanGroup = {
  module: string | null;
  nodes: ConceptSummary[];
};

export type ConceptForest = {
  roots: TreeNode[];
  orphanGroups: OrphanGroup[];
};

// --- Constants ---

const HIERARCHY_EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  "IS_A",
  "PART_OF",
  "INSTANCE_OF",
  "HAS_MAJOR_AREA",
]);

/**
 * For these types, `from` is child and `to` is parent.
 * HAS_MAJOR_AREA is reversed: `from` is parent, `to` is child.
 */
const CHILD_TO_PARENT_TYPES: ReadonlySet<EdgeType> = new Set([
  "IS_A",
  "PART_OF",
  "INSTANCE_OF",
]);

// --- Tree building ---

export function buildConceptForest(
  nodes: ConceptSummary[],
  edges: EdgeSummary[]
): ConceptForest {
  const nodeMap = new Map<string, ConceptSummary>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Build parent→children adjacency. Track which nodes are children.
  const parentToChildren = new Map<string, Set<string>>();
  const childToParent = new Map<string, string>();

  // Track all nodes that participate in any hierarchy edge (even skipped multi-parent)
  const hasHierarchyEdge = new Set<string>();

  for (const edge of edges) {
    if (!HIERARCHY_EDGE_TYPES.has(edge.type)) continue;

    let parentId: string;
    let childId: string;

    if (CHILD_TO_PARENT_TYPES.has(edge.type)) {
      childId = edge.fromConceptId;
      parentId = edge.toConceptId;
    } else {
      // HAS_MAJOR_AREA: from is parent, to is child
      parentId = edge.fromConceptId;
      childId = edge.toConceptId;
    }

    // Both nodes must exist in the node set
    if (!nodeMap.has(parentId) || !nodeMap.has(childId)) continue;
    // Skip self-loops
    if (parentId === childId) continue;

    // Mark both as hierarchy participants regardless of assignment
    hasHierarchyEdge.add(parentId);
    hasHierarchyEdge.add(childId);

    // Multi-parent: first parent wins
    if (childToParent.has(childId)) continue;

    childToParent.set(childId, parentId);
    let children = parentToChildren.get(parentId);
    if (!children) {
      children = new Set();
      parentToChildren.set(parentId, children);
    }
    children.add(childId);
  }

  // Break cycles in childToParent by walking parent chains
  for (const startId of childToParent.keys()) {
    const seen = new Set<string>();
    let current = startId;
    while (childToParent.has(current)) {
      if (seen.has(current)) {
        // Cycle detected — break it by removing this link, making current a root
        const parent = childToParent.get(current)!;
        childToParent.delete(current);
        const siblings = parentToChildren.get(parent);
        if (siblings) siblings.delete(current);
        break;
      }
      seen.add(current);
      current = childToParent.get(current)!;
    }
  }

  const rootIds: string[] = [];
  const orphanNodes: ConceptSummary[] = [];

  for (const node of nodes) {
    if (!hasHierarchyEdge.has(node.id)) {
      orphanNodes.push(node);
    } else if (!childToParent.has(node.id)) {
      rootIds.push(node.id);
    }
  }

  // Build tree recursively with cycle detection
  const visited = new Set<string>();

  function buildSubtree(nodeId: string, depth: number): TreeNode | null {
    if (visited.has(nodeId)) return null;
    const concept = nodeMap.get(nodeId);
    if (!concept) return null;

    visited.add(nodeId);

    const childIds = parentToChildren.get(nodeId);
    const children: TreeNode[] = [];
    if (childIds) {
      for (const cid of childIds) {
        const child = buildSubtree(cid, depth + 1);
        if (child) children.push(child);
      }
      children.sort((a, b) => a.concept.title.localeCompare(b.concept.title));
    }

    return { concept, children, depth };
  }

  // Sort roots alphabetically
  rootIds.sort((a, b) => {
    const na = nodeMap.get(a)!;
    const nb = nodeMap.get(b)!;
    return na.title.localeCompare(nb.title);
  });

  const roots: TreeNode[] = [];
  for (const rid of rootIds) {
    const tree = buildSubtree(rid, 0);
    if (tree) roots.push(tree);
  }

  // Group orphans by module
  const moduleGroups = new Map<string | null, ConceptSummary[]>();
  for (const n of orphanNodes) {
    const key = n.module;
    let group = moduleGroups.get(key);
    if (!group) {
      group = [];
      moduleGroups.set(key, group);
    }
    group.push(n);
  }

  const orphanGroups: OrphanGroup[] = [];
  for (const [mod, groupNodes] of moduleGroups) {
    groupNodes.sort((a, b) => a.title.localeCompare(b.title));
    orphanGroups.push({ module: mod, nodes: groupNodes });
  }
  orphanGroups.sort((a, b) => {
    if (a.module === null && b.module !== null) return 1;
    if (a.module !== null && b.module === null) return -1;
    if (a.module === null && b.module === null) return 0;
    return a.module!.localeCompare(b.module!);
  });

  return { roots, orphanGroups };
}

// --- Search filtering ---

/** Collect ancestor IDs (parent chain) for matched nodes. */
function collectAncestors(
  node: TreeNode,
  matchingIds: Set<string>,
  ancestors: Set<string>
): boolean {
  let hasMatch = matchingIds.has(node.concept.id);
  for (const child of node.children) {
    if (collectAncestors(child, matchingIds, ancestors)) {
      hasMatch = true;
    }
  }
  if (hasMatch) {
    ancestors.add(node.concept.id);
  }
  return hasMatch;
}

/** Prune branches with no matching descendants. */
function pruneTree(node: TreeNode, matchingIds: Set<string>, ancestorIds: Set<string>): TreeNode | null {
  if (!matchingIds.has(node.concept.id) && !ancestorIds.has(node.concept.id)) {
    return null;
  }

  const children: TreeNode[] = [];
  for (const child of node.children) {
    const pruned = pruneTree(child, matchingIds, ancestorIds);
    if (pruned) children.push(pruned);
  }

  return { concept: node.concept, children, depth: node.depth };
}

export type FilteredForest = {
  forest: ConceptForest;
  expandedIds: Set<string>;
};

export function filterConceptForest(
  forest: ConceptForest,
  matchingIds: Set<string>
): FilteredForest {
  // Compute ancestors of matching nodes (for auto-expand)
  const ancestorIds = new Set<string>();
  for (const root of forest.roots) {
    collectAncestors(root, matchingIds, ancestorIds);
  }

  // Prune tree
  const roots: TreeNode[] = [];
  for (const root of forest.roots) {
    const pruned = pruneTree(root, matchingIds, ancestorIds);
    if (pruned) roots.push(pruned);
  }

  // Filter orphan groups
  const orphanGroups: OrphanGroup[] = [];
  for (const group of forest.orphanGroups) {
    const filtered = group.nodes.filter((n) => matchingIds.has(n.id));
    if (filtered.length > 0) {
      orphanGroups.push({ module: group.module, nodes: filtered });
    }
  }

  // expandedIds = ancestors that are not themselves leaf matches
  // (we want to auto-expand parents of matches)
  const expandedIds = new Set<string>();
  for (const id of ancestorIds) {
    expandedIds.add(id);
  }

  return { forest: { roots, orphanGroups }, expandedIds };
}
