import { describe, expect, it } from "vitest";

import { computePrerequisitePath } from "./learning-path";

describe("computePrerequisitePath", () => {
  it("returns a deterministic topological ordering of prerequisites", () => {
    const edges = [
      { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "A", toConceptId: "C", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "B", toConceptId: "D", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "C", toConceptId: "D", type: "PREREQUISITE_OF" as const }
    ];

    const res = computePrerequisitePath({
      targetConceptId: "D",
      edges,
      sortKey: (id) => id
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.orderedConceptIds).toEqual(["A", "B", "C", "D"]);
  });

  it("detects cycles in the reachable prerequisite subgraph", () => {
    const edges = [
      { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "B", toConceptId: "C", type: "PREREQUISITE_OF" as const },
      { fromConceptId: "C", toConceptId: "A", type: "PREREQUISITE_OF" as const }
    ];

    const res = computePrerequisitePath({ targetConceptId: "A", edges });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.cycleNodeIds).toEqual(["A", "B", "C"]);
  });
});

