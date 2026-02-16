/**
 * Power iteration PageRank — pure TypeScript, no dependencies.
 * At 10K nodes, computes in <100ms.
 */

export type PageRankEdge = {
  fromConceptId: string;
  toConceptId: string;
};

export type PageRankOptions = {
  damping?: number;
  iterations?: number;
};

/**
 * Compute PageRank scores for a directed graph.
 * Returns a Map<nodeId, score> where scores sum to 1.
 */
export function computePageRank(
  nodeIds: string[],
  edges: PageRankEdge[],
  opts: PageRankOptions = {}
): Map<string, number> {
  const damping = opts.damping ?? 0.85;
  const iterations = opts.iterations ?? 20;
  const n = nodeIds.length;
  if (n === 0) return new Map();

  // Build adjacency: outLinks[from] = [to1, to2, ...]
  const outLinks = new Map<string, string[]>();
  for (const id of nodeIds) outLinks.set(id, []);
  for (const e of edges) {
    outLinks.get(e.fromConceptId)?.push(e.toConceptId);
  }

  // Initialize scores
  const initial = 1 / n;
  let scores = new Map<string, number>();
  for (const id of nodeIds) scores.set(id, initial);

  // Power iteration
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map<string, number>();
    const base = (1 - damping) / n;
    for (const id of nodeIds) next.set(id, base);

    // Dangling node mass (nodes with no outlinks)
    let danglingMass = 0;
    for (const id of nodeIds) {
      const out = outLinks.get(id)!;
      if (out.length === 0) danglingMass += scores.get(id)!;
    }
    const danglingDistrib = (damping * danglingMass) / n;

    for (const id of nodeIds) {
      const out = outLinks.get(id)!;
      if (out.length === 0) continue;
      const share = (damping * scores.get(id)!) / out.length;
      for (const target of out) {
        next.set(target, next.get(target)! + share);
      }
    }

    // Add dangling distribution
    for (const id of nodeIds) {
      next.set(id, next.get(id)! + danglingDistrib);
    }

    scores = next;
  }

  return scores;
}
