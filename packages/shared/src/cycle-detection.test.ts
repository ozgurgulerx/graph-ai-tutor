import { describe, expect, it } from "vitest";
import { wouldCreatePrereqCycle } from "./cycle-detection";

describe("wouldCreatePrereqCycle", () => {
  it("returns false when no cycle exists", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "B",
      toConceptId: "C",
      existingEdges: [
        { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" }
      ]
    });
    expect(result.wouldCycle).toBe(false);
  });

  it("detects a direct cycle (A→B, adding B→A)", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "B",
      toConceptId: "A",
      existingEdges: [
        { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" }
      ]
    });
    expect(result.wouldCycle).toBe(true);
    if (result.wouldCycle) {
      expect(result.cycleNodeIds).toContain("A");
      expect(result.cycleNodeIds).toContain("B");
    }
  });

  it("detects a transitive cycle (A→B→C, adding C→A)", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "C",
      toConceptId: "A",
      existingEdges: [
        { fromConceptId: "A", toConceptId: "B", type: "PREREQUISITE_OF" },
        { fromConceptId: "B", toConceptId: "C", type: "PREREQUISITE_OF" }
      ]
    });
    expect(result.wouldCycle).toBe(true);
    if (result.wouldCycle) {
      expect(result.cycleNodeIds).toContain("A");
      expect(result.cycleNodeIds).toContain("B");
      expect(result.cycleNodeIds).toContain("C");
    }
  });

  it("ignores non-PREREQUISITE_OF edges", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "B",
      toConceptId: "A",
      existingEdges: [
        { fromConceptId: "A", toConceptId: "B", type: "USED_IN" }
      ]
    });
    expect(result.wouldCycle).toBe(false);
  });

  it("detects self-loop", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "A",
      toConceptId: "A",
      existingEdges: []
    });
    expect(result.wouldCycle).toBe(true);
  });

  it("handles empty existing edges", () => {
    const result = wouldCreatePrereqCycle({
      fromConceptId: "A",
      toConceptId: "B",
      existingEdges: []
    });
    expect(result.wouldCycle).toBe(false);
  });
});
