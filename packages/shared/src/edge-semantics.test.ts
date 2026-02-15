import { describe, expect, it } from "vitest";

import { isPrereqEdge, getPrereqDirection, EDGE_TYPE_CATEGORIES, getDefaultEdgeTypes } from "./edge-semantics";
import { computePrerequisitePath } from "./learning-path";
import { EdgeTypeSchema } from "./schemas/api-v1";

describe("isPrereqEdge", () => {
  it("returns true for PREREQUISITE_OF", () => {
    expect(isPrereqEdge({ type: "PREREQUISITE_OF" })).toBe(true);
  });

  it("returns false for PART_OF", () => {
    expect(isPrereqEdge({ type: "PART_OF" })).toBe(false);
  });
});

describe("getPrereqDirection", () => {
  it("returns prereqId and dependentId for PREREQUISITE_OF edge", () => {
    const result = getPrereqDirection({
      fromConceptId: "A",
      toConceptId: "B",
      type: "PREREQUISITE_OF"
    });
    expect(result).toEqual({ prereqId: "A", dependentId: "B" });
  });

  it("returns null for non-PREREQUISITE_OF edges", () => {
    expect(
      getPrereqDirection({
        fromConceptId: "A",
        toConceptId: "B",
        type: "PART_OF"
      })
    ).toBeNull();
  });
});

describe("direction agreement with computePrerequisitePath", () => {
  it("getPrereqDirection prereqId comes before dependentId in topo order", () => {
    const edges = [
      { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "A", toConceptId: "C", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "B", toConceptId: "D", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "C", toConceptId: "D", type: "PREREQUISITE_OF" as const }
    ];

    const pathResult = computePrerequisitePath({
      targetConceptId: "D",
      edges,
      sortKey: (id) => id
    });

    expect(pathResult.ok).toBe(true);
    if (!pathResult.ok) return;

    const order = pathResult.orderedConceptIds;

    for (const edge of edges) {
      const dir = getPrereqDirection(edge);
      expect(dir).not.toBeNull();
      if (!dir) continue;

      const prereqIdx = order.indexOf(dir.prereqId);
      const depIdx = order.indexOf(dir.dependentId);

      expect(prereqIdx).toBeGreaterThanOrEqual(0);
      expect(depIdx).toBeGreaterThanOrEqual(0);
      expect(prereqIdx).toBeLessThan(depIdx);
    }
  });

  it("fails if fromConceptId/toConceptId are swapped in getPrereqDirection", () => {
    // This test documents that if someone were to swap the direction,
    // the topo order would disagree.
    const edge = { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" as const };
    const dir = getPrereqDirection(edge);
    expect(dir).not.toBeNull();
    if (!dir) return;

    // prereqId should be A (fromConceptId), dependentId should be B (toConceptId)
    expect(dir.prereqId).toBe("A");
    expect(dir.dependentId).toBe("B");

    // Swapping would produce the wrong answer
    expect(dir.prereqId).not.toBe(edge.toConceptId);
    expect(dir.dependentId).not.toBe(edge.fromConceptId);
  });
});

describe("EDGE_TYPE_CATEGORIES", () => {
  it("covers every EdgeType exactly once", () => {
    const all = EDGE_TYPE_CATEGORIES.flatMap((c) => [...c.types]);
    expect(new Set(all)).toEqual(new Set(EdgeTypeSchema.options));
    expect(all.length).toBe(EdgeTypeSchema.options.length);
  });

  it("getDefaultEdgeTypes returns only defaultOn category types", () => {
    const defaults = getDefaultEdgeTypes();
    const expected = EDGE_TYPE_CATEGORIES.filter((c) => c.defaultOn).flatMap((c) => [...c.types]);
    expect(defaults).toEqual(new Set(expected));
  });
});
