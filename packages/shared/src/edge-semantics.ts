import type { EdgeSummary } from "./schemas/api-v1";

/** A -[PREREQUISITE_OF]-> B means A is a prerequisite of B. */
export function isPrereqEdge(
  edge: Pick<EdgeSummary, "type">
): boolean {
  return edge.type === "PREREQUISITE_OF";
}

/**
 * Returns the canonical direction for a PREREQUISITE_OF edge.
 * A -[PREREQUISITE_OF]-> B: A is the prereq, B is the dependent.
 */
export function getPrereqDirection(
  edge: Pick<EdgeSummary, "fromConceptId" | "toConceptId" | "type">
): { prereqId: string; dependentId: string } | null {
  if (edge.type !== "PREREQUISITE_OF") return null;
  return { prereqId: edge.fromConceptId, dependentId: edge.toConceptId };
}
