import { describe, expect, it } from "vitest";
import { computeGraphLens } from "./graph-lens";
import type { EdgeType } from "./schemas/api-v1";

type Edge = { id: string; fromConceptId: string; toConceptId: string; type: EdgeType };
type Node = { id: string; title: string };

function prereq(id: string, from: string, to: string): Edge {
  return { id, fromConceptId: from, toConceptId: to, type: "PREREQUISITE_OF" };
}

function edge(id: string, from: string, to: string, type: EdgeType): Edge {
  return { id, fromConceptId: from, toConceptId: to, type };
}

function node(id: string, title: string): Node {
  return { id, title };
}

describe("computeGraphLens", () => {
  it("center node alone → side=center, depth=0, rank=0", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [],
      nodes: [node("C", "Center")],
      edgeTypeFilter: []
    });

    expect(result.nodeIds).toEqual(new Set(["C"]));
    expect(result.metadata).toEqual([
      { id: "C", side: "center", depth: 0, rank: 0 }
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("direct prerequisite (A→C) → A gets side=prereq, depth=1", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [prereq("e1", "A", "C")],
      nodes: [node("A", "Alpha"), node("C", "Center")],
      edgeTypeFilter: []
    });

    expect(result.nodeIds).toEqual(new Set(["A", "C"]));
    const aMeta = result.metadata.find((m) => m.id === "A");
    expect(aMeta).toEqual({ id: "A", side: "prereq", depth: 1, rank: 0 });
  });

  it("direct dependent (C→D) → D gets side=dependent, depth=1", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [prereq("e1", "C", "D")],
      nodes: [node("C", "Center"), node("D", "Delta")],
      edgeTypeFilter: []
    });

    expect(result.nodeIds).toEqual(new Set(["C", "D"]));
    const dMeta = result.metadata.find((m) => m.id === "D");
    expect(dMeta).toEqual({ id: "D", side: "dependent", depth: 1, rank: 0 });
  });

  it("multi-depth chain A→B→C→D→E with radius=2 → correct depth per node", () => {
    // A -prereqOf-> B -prereqOf-> C -prereqOf-> D -prereqOf-> E
    const result = computeGraphLens({
      centerId: "C",
      radius: 2,
      edges: [
        prereq("e1", "A", "B"),
        prereq("e2", "B", "C"),
        prereq("e3", "C", "D"),
        prereq("e4", "D", "E")
      ],
      nodes: [
        node("A", "Alpha"),
        node("B", "Beta"),
        node("C", "Center"),
        node("D", "Delta"),
        node("E", "Echo")
      ],
      edgeTypeFilter: []
    });

    const meta = new Map(result.metadata.map((m) => [m.id, m]));

    expect(meta.get("C")).toMatchObject({ side: "center", depth: 0 });
    expect(meta.get("B")).toMatchObject({ side: "prereq", depth: 1 });
    expect(meta.get("A")).toMatchObject({ side: "prereq", depth: 2 });
    expect(meta.get("D")).toMatchObject({ side: "dependent", depth: 1 });
    expect(meta.get("E")).toMatchObject({ side: "dependent", depth: 2 });
  });

  it("radius=1 only goes 1 hop (does not see 2-hop nodes)", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [
        prereq("e1", "A", "B"),
        prereq("e2", "B", "C"),
        prereq("e3", "C", "D"),
        prereq("e4", "D", "E")
      ],
      nodes: [
        node("A", "Alpha"),
        node("B", "Beta"),
        node("C", "Center"),
        node("D", "Delta"),
        node("E", "Echo")
      ],
      edgeTypeFilter: []
    });

    expect(result.nodeIds).toEqual(new Set(["B", "C", "D"]));
    expect(result.nodeIds.has("A")).toBe(false);
    expect(result.nodeIds.has("E")).toBe(false);
  });

  it("cycle A→B→C→A → 'cycle_detected' warning + partial results", () => {
    // A -prereqOf-> B -prereqOf-> C -prereqOf-> A (cycle back to center)
    const result = computeGraphLens({
      centerId: "A",
      radius: 2,
      edges: [
        prereq("e1", "A", "B"),
        prereq("e2", "B", "C"),
        prereq("e3", "C", "A")
      ],
      nodes: [
        node("A", "Alpha"),
        node("B", "Beta"),
        node("C", "Charlie")
      ],
      edgeTypeFilter: []
    });

    expect(result.warnings).toContain("cycle_detected");
    // Should still have partial results
    expect(result.nodeIds.has("A")).toBe(true);
    expect(result.metadata.length).toBeGreaterThan(0);
  });

  it("rank alphabetical within (side, depth) group", () => {
    // Two prereqs at depth 1: Zeta and Alpha → Alpha gets rank 0, Zeta gets rank 1
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [
        prereq("e1", "Z", "C"),
        prereq("e2", "A", "C")
      ],
      nodes: [
        node("A", "Alpha"),
        node("C", "Center"),
        node("Z", "Zeta")
      ],
      edgeTypeFilter: []
    });

    const prereqs = result.metadata
      .filter((m) => m.side === "prereq")
      .sort((a, b) => a.rank - b.rank);

    expect(prereqs[0]).toMatchObject({ id: "A", rank: 0 });
    expect(prereqs[1]).toMatchObject({ id: "Z", rank: 1 });
  });

  it("secondary non-PREREQUISITE_OF edges included between lens nodes", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [
        prereq("e1", "A", "C"),
        edge("e2", "A", "C", "CONTRASTS_WITH")
      ],
      nodes: [node("A", "Alpha"), node("C", "Center")],
      edgeTypeFilter: []
    });

    expect(result.edgeIds).toEqual(new Set(["e1", "e2"]));
  });

  it("edgeTypeFilter excludes non-matching secondary edges; PREREQUISITE_OF always included", () => {
    const result = computeGraphLens({
      centerId: "C",
      radius: 1,
      edges: [
        prereq("e1", "A", "C"),
        edge("e2", "A", "C", "CONTRASTS_WITH"),
        edge("e3", "A", "C", "PART_OF")
      ],
      nodes: [node("A", "Alpha"), node("C", "Center")],
      edgeTypeFilter: ["PART_OF"]
    });

    // e1 (PREREQUISITE_OF) always included, e3 (PART_OF) matches filter, e2 (CONTRASTS_WITH) excluded
    expect(result.edgeIds).toEqual(new Set(["e1", "e3"]));
  });
});
