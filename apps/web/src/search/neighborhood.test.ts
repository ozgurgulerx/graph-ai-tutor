import { describe, expect, it } from "vitest";

import { collectTieredNeighborhood, collectWithinHops } from "./neighborhood";

describe("collectWithinHops", () => {
  it("keeps only the start id at 0 hops", () => {
    const kept = collectWithinHops([{ fromConceptId: "a", toConceptId: "b" }], "a", 0);
    expect(Array.from(kept).sort()).toEqual(["a"]);
  });

  it("collects nodes within 2 hops (undirected)", () => {
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" },
      { fromConceptId: "c", toConceptId: "d" }
    ];

    const kept = collectWithinHops(edges, "a", 2);
    expect(Array.from(kept).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("collectTieredNeighborhood", () => {
  const edges = [
    { fromConceptId: "a", toConceptId: "b" },
    { fromConceptId: "a", toConceptId: "c" },
    { fromConceptId: "b", toConceptId: "d" },
    { fromConceptId: "c", toConceptId: "e" },
    { fromConceptId: "d", toConceptId: "f" }
  ];

  it("returns center, L1, and L2 tiers", () => {
    const result = collectTieredNeighborhood(edges, "a");
    expect(result.center).toBe("a");
    expect(Array.from(result.l1).sort()).toEqual(["b", "c"]);
    expect(Array.from(result.l2).sort()).toEqual(["d", "e"]);
  });

  it("returns empty L1 and L2 for isolated node", () => {
    const result = collectTieredNeighborhood(edges, "z");
    expect(result.center).toBe("z");
    expect(result.l1.size).toBe(0);
    expect(result.l2.size).toBe(0);
  });

  it("respects allowedTypes filter", () => {
    const typedEdges = [
      { fromConceptId: "a", toConceptId: "b", type: "PREREQUISITE_OF" },
      { fromConceptId: "a", toConceptId: "c", type: "RELATED_TO" },
      { fromConceptId: "b", toConceptId: "d", type: "PREREQUISITE_OF" }
    ];
    const result = collectTieredNeighborhood(
      typedEdges,
      "a",
      new Set(["PREREQUISITE_OF"])
    );
    expect(Array.from(result.l1).sort()).toEqual(["b"]);
    expect(Array.from(result.l2).sort()).toEqual(["d"]);
  });

  it("treats edges as undirected", () => {
    const result = collectTieredNeighborhood(edges, "d");
    expect(result.center).toBe("d");
    expect(Array.from(result.l1).sort()).toEqual(["b", "f"]);
    expect(Array.from(result.l2).sort()).toEqual(["a"]);
  });
});

