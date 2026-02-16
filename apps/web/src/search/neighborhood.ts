export type EdgeLike = { fromConceptId: string; toConceptId: string };
export type EdgeLikeTyped = EdgeLike & { type?: string };
export type TieredNeighborhood = { center: string; l1: Set<string>; l2: Set<string> };

export function collectTieredNeighborhood(
  edges: ReadonlyArray<EdgeLikeTyped>,
  centerId: string,
  allowedTypes?: ReadonlySet<string>
): TieredNeighborhood {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    const existing = adj.get(a);
    if (existing) existing.add(b);
    else adj.set(a, new Set([b]));
  };

  for (const e of edges) {
    if (!e.fromConceptId || !e.toConceptId) continue;
    if (allowedTypes && e.type && !allowedTypes.has(e.type)) continue;
    add(e.fromConceptId, e.toConceptId);
    add(e.toConceptId, e.fromConceptId);
  }

  const l1 = new Set<string>();
  const l2 = new Set<string>();

  // Hop 1: direct neighbors of center
  const centerNeighbors = adj.get(centerId);
  if (centerNeighbors) {
    for (const id of centerNeighbors) {
      if (id !== centerId) l1.add(id);
    }
  }

  // Hop 2: neighbors of L1, excluding center and L1
  for (const l1Id of l1) {
    const neighbors = adj.get(l1Id);
    if (!neighbors) continue;
    for (const id of neighbors) {
      if (id !== centerId && !l1.has(id)) l2.add(id);
    }
  }

  return { center: centerId, l1, l2 };
}

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

