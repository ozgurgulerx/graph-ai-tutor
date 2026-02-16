/**
 * Label Propagation Algorithm for community detection — pure TypeScript.
 * O(E) per iteration. At 10K edges, <50ms.
 */

export type CommunityEdge = {
  fromConceptId: string;
  toConceptId: string;
};

export type CommunityDetectionOptions = {
  maxIterations?: number;
};

/**
 * Detect communities via Label Propagation.
 * Each node starts with its own label, then iteratively adopts the most
 * frequent label among its neighbors. Returns a Map<nodeId, communityLabel>.
 */
export function detectCommunities(
  nodeIds: string[],
  edges: CommunityEdge[],
  opts: CommunityDetectionOptions = {}
): Map<string, string> {
  const maxIterations = opts.maxIterations ?? 10;
  if (nodeIds.length === 0) return new Map();

  // Build undirected adjacency list
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.fromConceptId)?.push(e.toConceptId);
    adj.get(e.toConceptId)?.push(e.fromConceptId);
  }

  // Initialize: each node is its own community
  const labels = new Map<string, string>();
  for (const id of nodeIds) labels.set(id, id);

  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Process nodes in random order for convergence
    const shuffled = [...nodeIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const id of shuffled) {
      const neighbors = adj.get(id)!;
      if (neighbors.length === 0) continue;

      // Count neighbor labels
      const freq = new Map<string, number>();
      for (const n of neighbors) {
        const lbl = labels.get(n)!;
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }

      // Find most frequent label
      let maxCount = 0;
      let bestLabel = labels.get(id)!;
      for (const [lbl, count] of freq) {
        if (count > maxCount) {
          maxCount = count;
          bestLabel = lbl;
        }
      }

      if (bestLabel !== labels.get(id)) {
        labels.set(id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return labels;
}
