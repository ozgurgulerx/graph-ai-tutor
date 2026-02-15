import type { EdgeSummary } from "./schemas/api-v1";

export type PrerequisitePathOk = {
  ok: true;
  orderedConceptIds: string[];
};

export type PrerequisitePathCycle = {
  ok: false;
  cycleNodeIds: string[];
};

export type PrerequisitePathResult = PrerequisitePathOk | PrerequisitePathCycle;

function compareByKey(
  a: string,
  b: string,
  sortKey: (conceptId: string) => string
): number {
  const ka = sortKey(a).toLowerCase();
  const kb = sortKey(b).toLowerCase();
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return a.localeCompare(b);
}

/**
 * Computes a topological ordering of the prerequisite subgraph reachable *into* `targetConceptId`
 * via `PREREQUISITE_OF` edges.
 *
 * Semantics: `A -[PREREQUISITE_OF]-> B` means A is a prerequisite of B.
 */
export function computePrerequisitePath(params: {
  targetConceptId: string;
  edges: ReadonlyArray<Pick<EdgeSummary, "fromConceptId" | "toConceptId" | "type">>;
  sortKey?: (conceptId: string) => string;
}): PrerequisitePathResult {
  const sortKey = params.sortKey ?? ((id: string) => id);

  const prereqsOf = new Map<string, Set<string>>();

  for (const e of params.edges) {
    if (e.type !== "PREREQUISITE_OF") continue;
    const set = prereqsOf.get(e.toConceptId) ?? new Set<string>();
    set.add(e.fromConceptId);
    prereqsOf.set(e.toConceptId, set);
  }

  const target = params.targetConceptId;
  const visited = new Set<string>([target]);
  const ancestors = new Set<string>();
  const stack: string[] = [target];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    const prereqs = prereqsOf.get(node);
    if (!prereqs) continue;
    for (const p of prereqs) {
      if (visited.has(p)) continue;
      visited.add(p);
      ancestors.add(p);
      stack.push(p);
    }
  }

  const nodeSet = new Set<string>([...ancestors, target]);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of nodeSet) {
    indegree.set(id, 0);
    outgoing.set(id, []);
  }

  for (const e of params.edges) {
    if (e.type !== "PREREQUISITE_OF") continue;
    if (!nodeSet.has(e.fromConceptId) || !nodeSet.has(e.toConceptId)) continue;
    outgoing.get(e.fromConceptId)?.push(e.toConceptId);
    indegree.set(e.toConceptId, (indegree.get(e.toConceptId) ?? 0) + 1);
  }

  for (const [id, deps] of outgoing) {
    deps.sort((a, b) => compareByKey(a, b, sortKey));
    outgoing.set(id, deps);
  }

  const ready = [...nodeSet].filter((id) => (indegree.get(id) ?? 0) === 0);
  ready.sort((a, b) => compareByKey(a, b, sortKey));

  const ordered: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift();
    if (!next) break;
    ordered.push(next);

    for (const dep of outgoing.get(next) ?? []) {
      const n = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, n);
      if (n === 0) {
        ready.push(dep);
      }
    }

    ready.sort((a, b) => compareByKey(a, b, sortKey));
  }

  if (ordered.length !== nodeSet.size) {
    const remaining = [...nodeSet].filter((id) => (indegree.get(id) ?? 0) > 0);
    remaining.sort((a, b) => compareByKey(a, b, sortKey));
    return { ok: false, cycleNodeIds: remaining };
  }

  return { ok: true, orderedConceptIds: ordered };
}

