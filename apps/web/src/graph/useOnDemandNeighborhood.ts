import { useCallback, useRef, useState } from "react";
import type { GraphResponse } from "@graph-ai-tutor/shared";
import { getGraphLocal } from "../api/client";
import { LruCache } from "./LruCache";

export type OnDemandOptions = {
  depth?: number;
  typeFilters?: string[];
  maxNodes?: number;
  maxEdges?: number;
};

export type OnDemandState = {
  data: GraphResponse | null;
  centerId: string | null;
  hops: Map<string, number>;
  loading: boolean;
  error: string | null;
  capped: boolean;
  fetchNeighborhood: (centerId: string) => void;
  clearCache: () => void;
};

function cacheKey(
  centerId: string,
  depth: number,
  typeFilters: string[],
  maxNodes?: number,
  maxEdges?: number
): string {
  const filterHash = typeFilters.slice().sort().join(",");
  return `${centerId}:${depth}:${filterHash}:${maxNodes ?? ""}:${maxEdges ?? ""}`;
}

/**
 * BFS over a small subgraph to compute hop distance from the center.
 */
export function computeHops(
  centerId: string,
  edges: ReadonlyArray<{ fromConceptId: string; toConceptId: string }>
): Map<string, number> {
  const hops = new Map<string, number>();
  hops.set(centerId, 0);
  let frontier = new Set<string>([centerId]);
  let hop = 0;
  while (frontier.size > 0) {
    hop++;
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.fromConceptId) && !hops.has(edge.toConceptId)) {
        hops.set(edge.toConceptId, hop);
        next.add(edge.toConceptId);
      }
      if (frontier.has(edge.toConceptId) && !hops.has(edge.fromConceptId)) {
        hops.set(edge.fromConceptId, hop);
        next.add(edge.fromConceptId);
      }
    }
    frontier = next;
  }
  return hops;
}

export function useOnDemandNeighborhood(opts: OnDemandOptions): OnDemandState {
  const depth = opts.depth ?? 2;
  const typeFilters = opts.typeFilters ?? [];
  const maxNodes = opts.maxNodes;
  const maxEdges = opts.maxEdges;

  const [data, setData] = useState<GraphResponse | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [hops, setHops] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);

  const cacheRef = useRef(new LruCache<GraphResponse>(200));
  const abortRef = useRef<AbortController | null>(null);

  // Keep latest opts in refs so the callback doesn't depend on them
  const optsRef = useRef({ depth, typeFilters, maxNodes, maxEdges });
  optsRef.current = { depth, typeFilters, maxNodes, maxEdges };

  const fetchNeighborhood = useCallback((newCenterId: string) => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();

    const { depth: d, typeFilters: tf, maxNodes: mn, maxEdges: me } = optsRef.current;
    const key = cacheKey(newCenterId, d, tf, mn, me);

    // Check cache
    const cached = cacheRef.current.get(key);
    if (cached) {
      const hopMap = computeHops(newCenterId, cached.edges);
      setData(cached);
      setCenterId(newCenterId);
      setHops(hopMap);
      setCapped(cached.capped ?? false);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setCenterId(newCenterId);

    getGraphLocal({
      center: newCenterId,
      depth: d,
      typeFilters: tf.length > 0 ? tf : undefined,
      maxNodes: mn,
      maxEdges: me,
      signal: controller.signal
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(key, response);
        const hopMap = computeHops(newCenterId, response.edges);
        setData(response);
        setHops(hopMap);
        setCapped(response.capped ?? false);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to fetch neighborhood");
        setLoading(false);
      });
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { data, centerId, hops, loading, error, capped, fetchNeighborhood, clearCache };
}
