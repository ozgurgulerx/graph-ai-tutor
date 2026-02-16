import { describe, it, expect } from "vitest";
import { detectCommunities } from "./community-detection";

describe("detectCommunities", () => {
  it("returns empty map for empty graph", () => {
    const result = detectCommunities([], []);
    expect(result.size).toBe(0);
  });

  it("assigns isolated nodes to their own community", () => {
    const result = detectCommunities(["a", "b", "c"], []);
    expect(result.size).toBe(3);
    // Each isolated node has its own label
    expect(result.get("a")).toBe("a");
    expect(result.get("b")).toBe("b");
    expect(result.get("c")).toBe("c");
  });

  it("assigns connected nodes to the same community", () => {
    const nodes = ["a", "b", "c"];
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" }
    ];
    const result = detectCommunities(nodes, edges);
    // All three should converge to the same label
    const labels = new Set(result.values());
    expect(labels.size).toBe(1);
  });

  it("detects two separate communities in disconnected subgraphs", () => {
    const nodes = ["a", "b", "c", "x", "y", "z"];
    const edges = [
      { fromConceptId: "a", toConceptId: "b" },
      { fromConceptId: "b", toConceptId: "c" },
      { fromConceptId: "a", toConceptId: "c" },
      { fromConceptId: "x", toConceptId: "y" },
      { fromConceptId: "y", toConceptId: "z" },
      { fromConceptId: "x", toConceptId: "z" }
    ];
    const result = detectCommunities(nodes, edges);

    // Nodes in the same subgraph should share a label
    expect(result.get("a")).toBe(result.get("b"));
    expect(result.get("a")).toBe(result.get("c"));
    expect(result.get("x")).toBe(result.get("y"));
    expect(result.get("x")).toBe(result.get("z"));

    // The two subgraphs should have different labels
    expect(result.get("a")).not.toBe(result.get("x"));
  });
});
