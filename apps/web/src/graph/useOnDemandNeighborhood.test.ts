import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computeHops, useOnDemandNeighborhood } from "./useOnDemandNeighborhood";

vi.mock("../api/client", () => ({
  getGraphLocal: vi.fn()
}));

import { getGraphLocal } from "../api/client";
const mockGetGraphLocal = vi.mocked(getGraphLocal);

describe("computeHops", () => {
  it("returns hop 0 for center with no edges", () => {
    const hops = computeHops("a", []);
    expect(hops.get("a")).toBe(0);
    expect(hops.size).toBe(1);
  });

  it("computes hop distances for a linear graph", () => {
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" }
    ];
    const hops = computeHops("a", edges);
    expect(hops.get("a")).toBe(0);
    expect(hops.get("b")).toBe(1);
    expect(hops.get("c")).toBe(2);
  });

  it("handles cycles", () => {
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" },
      { fromConceptId: "c", toConceptId: "a" }
    ];
    const hops = computeHops("a", edges);
    expect(hops.get("a")).toBe(0);
    expect(hops.get("b")).toBe(1);
    // c is reachable from a via c->a edge (undirected), so hop 1
    expect(hops.get("c")).toBe(1);
  });

  it("handles undirected traversal", () => {
    const edges = [{ fromConceptId: "b", toConceptId: "a" }];
    const hops = computeHops("a", edges);
    expect(hops.get("a")).toBe(0);
    expect(hops.get("b")).toBe(1);
  });
});

describe("useOnDemandNeighborhood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useOnDemandNeighborhood({ depth: 2 })
    );
    expect(result.current.data).toBeNull();
    expect(result.current.centerId).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.capped).toBe(false);
  });

  it("fetches neighborhood and updates state", async () => {
    const mockResponse = {
      nodes: [
        { id: "a", title: "A", kind: "Concept" as const, module: null, masteryScore: 0, pagerank: 0, community: null },
        { id: "b", title: "B", kind: "Concept" as const, module: null, masteryScore: 0, pagerank: 0, community: null }
      ],
      edges: [{ id: "e1", fromConceptId: "a", toConceptId: "b", type: "PREREQUISITE_OF" as const }],
      capped: false
    };
    mockGetGraphLocal.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() =>
      useOnDemandNeighborhood({ depth: 2 })
    );

    act(() => {
      result.current.fetchNeighborhood("a");
    });

    expect(result.current.loading).toBe(true);

    // Wait for the promise to resolve
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.centerId).toBe("a");
    expect(result.current.hops.get("a")).toBe(0);
    expect(result.current.hops.get("b")).toBe(1);
    expect(result.current.capped).toBe(false);
  });

  it("uses cache on second fetch of same center", async () => {
    const mockResponse = {
      nodes: [{ id: "a", title: "A", kind: "Concept" as const, module: null, masteryScore: 0, pagerank: 0, community: null }],
      edges: [],
      capped: false
    };
    mockGetGraphLocal.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() =>
      useOnDemandNeighborhood({ depth: 2 })
    );

    act(() => {
      result.current.fetchNeighborhood("a");
    });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Fetch again — should hit cache
    act(() => {
      result.current.fetchNeighborhood("a");
    });

    expect(mockGetGraphLocal).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockResponse);
  });

  it("handles fetch errors", async () => {
    mockGetGraphLocal.mockRejectedValueOnce(new Error("Network fail"));

    const { result } = renderHook(() =>
      useOnDemandNeighborhood({ depth: 2 })
    );

    act(() => {
      result.current.fetchNeighborhood("a");
    });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network fail");
    expect(result.current.data).toBeNull();
  });
});
