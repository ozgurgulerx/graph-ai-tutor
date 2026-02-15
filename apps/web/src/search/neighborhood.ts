export type EdgeLike = { fromConceptId: string; toConceptId: string };

export function collectWithinHops(
  edges: ReadonlyArray<EdgeLike>,
  startId: string,
  maxHops: number
): Set<string> {
  const hops = Math.max(0, Math.trunc(maxHops));

  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    const existing = adj.get(a);
    if (existing) existing.add(b);
    else adj.set(a, new Set([b]));
  };

  for (const e of edges) {
    if (!e.fromConceptId || !e.toConceptId) continue;
    add(e.fromConceptId, e.toConceptId);
    add(e.toConceptId, e.fromConceptId);
  }

  const kept = new Set<string>([startId]);
  let frontier: string[] = [startId];

  for (let step = 0; step < hops; step++) {
    if (frontier.length === 0) break;
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = adj.get(id);
      if (!neighbors) continue;
      for (const other of neighbors) {
        if (kept.has(other)) continue;
        kept.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }

  return kept;
}

