import { describe, expect, it } from "vitest";

import { collectWithinHops } from "./neighborhood";

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

