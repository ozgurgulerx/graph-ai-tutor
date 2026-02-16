import { describe, expect, it } from "vitest";

import type { ConceptSummary, EdgeSummary } from "@graph-ai-tutor/shared";

import { buildConceptForest, filterConceptForest } from "./buildConceptTree";

function node(id: string, title: string, module: string | null = null): ConceptSummary {
  return { id, title, kind: "Concept", module, masteryScore: 0, pagerank: 0, community: null };
}

function edge(from: string, to: string, type: EdgeSummary["type"]): EdgeSummary {
  return { id: `${from}-${to}`, fromConceptId: from, toConceptId: to, type };
}

describe("buildConceptForest", () => {
  it("builds a tree from IS_A edges (child→parent)", () => {
    const nodes = [node("animal", "Animal"), node("dog", "Dog"), node("cat", "Cat")];
    const edges = [edge("dog", "animal", "IS_A"), edge("cat", "animal", "IS_A")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(1);
    expect(forest.roots[0].concept.id).toBe("animal");
    expect(forest.roots[0].children).toHaveLength(2);
    expect(forest.roots[0].children[0].concept.title).toBe("Cat");
    expect(forest.roots[0].children[1].concept.title).toBe("Dog");
    expect(forest.orphanGroups).toHaveLength(0);
  });

  it("builds a tree from HAS_MAJOR_AREA edges (parent→child)", () => {
    const nodes = [node("math", "Mathematics"), node("algebra", "Algebra"), node("calc", "Calculus")];
    const edges = [
      edge("math", "algebra", "HAS_MAJOR_AREA"),
      edge("math", "calc", "HAS_MAJOR_AREA"),
    ];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(1);
    expect(forest.roots[0].concept.id).toBe("math");
    expect(forest.roots[0].children.map((c) => c.concept.id)).toEqual(["algebra", "calc"]);
  });

  it("builds a tree from PART_OF edges", () => {
    const nodes = [node("car", "Car"), node("engine", "Engine")];
    const edges = [edge("engine", "car", "PART_OF")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(1);
    expect(forest.roots[0].concept.id).toBe("car");
    expect(forest.roots[0].children[0].concept.id).toBe("engine");
  });

  it("builds a tree from INSTANCE_OF edges", () => {
    const nodes = [node("relu", "ReLU"), node("activation", "Activation Function")];
    const edges = [edge("relu", "activation", "INSTANCE_OF")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(1);
    expect(forest.roots[0].concept.id).toBe("activation");
    expect(forest.roots[0].children[0].concept.id).toBe("relu");
  });

  it("ignores non-hierarchy edge types", () => {
    const nodes = [node("a", "A"), node("b", "B")];
    const edges = [edge("a", "b", "PREREQUISITE_OF"), edge("a", "b", "CONTRASTS_WITH")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(0);
    expect(forest.orphanGroups.flatMap((g) => g.nodes)).toHaveLength(2);
  });

  it("groups orphan nodes by module", () => {
    const nodes = [
      node("a", "Alpha", "mod1"),
      node("b", "Beta", "mod1"),
      node("c", "Gamma", "mod2"),
      node("d", "Delta", null),
    ];
    const edges: EdgeSummary[] = [];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots).toHaveLength(0);
    expect(forest.orphanGroups).toHaveLength(3);
    expect(forest.orphanGroups[0].module).toBe("mod1");
    expect(forest.orphanGroups[0].nodes.map((n) => n.title)).toEqual(["Alpha", "Beta"]);
    expect(forest.orphanGroups[1].module).toBe("mod2");
    expect(forest.orphanGroups[2].module).toBe(null);
  });

  it("assigns multi-parent child to first parent encountered", () => {
    const nodes = [node("p1", "Parent1"), node("p2", "Parent2"), node("child", "Child")];
    const edges = [edge("child", "p1", "IS_A"), edge("child", "p2", "IS_A")];

    const forest = buildConceptForest(nodes, edges);

    // child assigned to p1 (first edge), p2 has no children
    const p1 = forest.roots.find((r) => r.concept.id === "p1")!;
    const p2 = forest.roots.find((r) => r.concept.id === "p2")!;
    expect(p1.children).toHaveLength(1);
    expect(p2.children).toHaveLength(0);
  });

  it("breaks cycles via visited set", () => {
    const nodes = [node("a", "A"), node("b", "B")];
    // A IS_A B, B IS_A A → cycle
    const edges = [edge("a", "b", "IS_A"), edge("b", "a", "IS_A")];

    // Should not throw; first edge wins (a→b means b is parent of a)
    const forest = buildConceptForest(nodes, edges);
    expect(forest.roots.length + forest.orphanGroups.flatMap((g) => g.nodes).length).toBeGreaterThan(0);
  });

  it("handles dangling parent reference (parent not in node set)", () => {
    const nodes = [node("child", "Child")];
    // parent "missing" is not in nodes
    const edges = [edge("child", "missing", "IS_A")];

    const forest = buildConceptForest(nodes, edges);

    // child becomes orphan since parent isn't in node set
    expect(forest.roots).toHaveLength(0);
    expect(forest.orphanGroups.flatMap((g) => g.nodes)).toHaveLength(1);
  });

  it("sorts roots and children alphabetically", () => {
    const nodes = [
      node("z", "Zebra"),
      node("a", "Apple"),
      node("m", "Mango"),
      node("b", "Banana"),
    ];
    const edges = [
      edge("b", "z", "IS_A"),
      edge("m", "a", "IS_A"),
    ];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots.map((r) => r.concept.title)).toEqual(["Apple", "Zebra"]);
  });

  it("sets correct depth values", () => {
    const nodes = [node("root", "Root"), node("mid", "Mid"), node("leaf", "Leaf")];
    const edges = [edge("mid", "root", "IS_A"), edge("leaf", "mid", "IS_A")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.roots[0].depth).toBe(0);
    expect(forest.roots[0].children[0].depth).toBe(1);
    expect(forest.roots[0].children[0].children[0].depth).toBe(2);
  });

  it("skips self-loop edges", () => {
    const nodes = [node("a", "A")];
    const edges = [edge("a", "a", "IS_A")];

    const forest = buildConceptForest(nodes, edges);

    expect(forest.orphanGroups.flatMap((g) => g.nodes)).toHaveLength(1);
  });
});

describe("filterConceptForest", () => {
  const nodes = [
    node("root", "Root"),
    node("child1", "Alpha Child"),
    node("child2", "Beta Child"),
    node("grandchild", "Grandchild"),
    node("orphan", "Orphan", "misc"),
  ];
  const edges = [
    edge("child1", "root", "IS_A"),
    edge("child2", "root", "IS_A"),
    edge("grandchild", "child1", "IS_A"),
  ];

  it("prunes non-matching branches", () => {
    const forest = buildConceptForest(nodes, edges);
    const matchingIds = new Set(["grandchild"]);

    const { forest: filtered } = filterConceptForest(forest, matchingIds);

    expect(filtered.roots).toHaveLength(1);
    expect(filtered.roots[0].concept.id).toBe("root");
    expect(filtered.roots[0].children).toHaveLength(1);
    expect(filtered.roots[0].children[0].concept.id).toBe("child1");
    expect(filtered.roots[0].children[0].children[0].concept.id).toBe("grandchild");
  });

  it("returns expandedIds containing ancestors of matches", () => {
    const forest = buildConceptForest(nodes, edges);
    const matchingIds = new Set(["grandchild"]);

    const { expandedIds } = filterConceptForest(forest, matchingIds);

    expect(expandedIds.has("root")).toBe(true);
    expect(expandedIds.has("child1")).toBe(true);
    expect(expandedIds.has("grandchild")).toBe(true);
  });

  it("filters orphan groups", () => {
    const forest = buildConceptForest(nodes, edges);
    const matchingIds = new Set(["orphan"]);

    const { forest: filtered } = filterConceptForest(forest, matchingIds);

    expect(filtered.roots).toHaveLength(0);
    expect(filtered.orphanGroups).toHaveLength(1);
    expect(filtered.orphanGroups[0].nodes[0].id).toBe("orphan");
  });

  it("returns empty forest when nothing matches", () => {
    const forest = buildConceptForest(nodes, edges);
    const matchingIds = new Set(["nonexistent"]);

    const { forest: filtered } = filterConceptForest(forest, matchingIds);

    expect(filtered.roots).toHaveLength(0);
    expect(filtered.orphanGroups).toHaveLength(0);
  });
});
