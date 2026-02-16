import { describe, it, expect } from "vitest";
import { computePageRank } from "./pagerank";

describe("computePageRank", () => {
  it("returns empty map for empty graph", () => {
    const result = computePageRank([], []);
    expect(result.size).toBe(0);
  });

  it("returns equal scores for disconnected nodes", () => {
    const result = computePageRank(["a", "b", "c"], []);
    const scores = Array.from(result.values());
    for (const s of scores) {
      expect(s).toBeCloseTo(1 / 3, 5);
    }
  });

  it("gives higher rank to nodes with more incoming edges", () => {
    const nodes = ["a", "b", "c"];
    const edges = [
      { fromConceptId: "a", toConceptId: "c" },
      { fromConceptId: "b", toConceptId: "c" }
    ];
    const result = computePageRank(nodes, edges);
    expect(result.get("c")!).toBeGreaterThan(result.get("a")!);
    expect(result.get("c")!).toBeGreaterThan(result.get("b")!);
  });

  it("scores sum to approximately 1", () => {
    const nodes = ["a", "b", "c", "d"];
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" },
      { fromConceptId: "c", toConceptId: "a" },
      { fromConceptId: "d", toConceptId: "b" }
    ];
    const result = computePageRank(nodes, edges);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("handles single node", () => {
    const result = computePageRank(["x"], []);
    expect(result.get("x")).toBeCloseTo(1, 5);
  });
});
