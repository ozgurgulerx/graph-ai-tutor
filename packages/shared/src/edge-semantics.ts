import type { EdgeSummary, EdgeType } from "./schemas/api-v1";

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

export type EdgeTypeCategory = {
  id: string;
  label: string;
  types: readonly EdgeType[];
  defaultOn: boolean;
};

export const EDGE_TYPE_CATEGORIES: readonly EdgeTypeCategory[] = [
  {
    id: "structural",
    label: "Structural",
    types: ["PREREQUISITE_OF", "IS_A", "PART_OF", "INSTANCE_OF", "HAS_MAJOR_AREA"],
    defaultOn: true,
  },
  {
    id: "dependency",
    label: "Dependency",
    types: ["ENABLES", "REQUIRES", "DEPENDS_ON", "ADDRESSES_FAILURE_MODE"],
    defaultOn: false,
  },
  {
    id: "comparative",
    label: "Comparative",
    types: ["CONTRASTS_WITH", "CONFUSED_WITH", "COMPETES_WITH"],
    defaultOn: false,
  },
  {
    id: "production",
    label: "Production",
    types: ["PRODUCES", "CONSUMES", "USED_IN", "OPTIMIZED_BY", "TRAINED_WITH"],
    defaultOn: false,
  },
  {
    id: "historical",
    label: "Historical",
    types: ["INTRODUCED_BY", "POPULARIZED_BY", "ADVANCES", "ANSWERED_BY", "INTRODUCED"],
    defaultOn: false,
  },
  {
    id: "governance",
    label: "Governance",
    types: ["GOVERNED_BY", "STANDARDIZED_BY", "MITIGATED_BY", "ATTACKED_BY", "ALIGNED_WITH"],
    defaultOn: false,
  },
  {
    id: "evaluation",
    label: "Evaluation",
    types: ["EVALUATED_BY", "INSTRUMENTED_BY"],
    defaultOn: false,
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    types: ["OFFERS_MODEL", "INCLUDES_MODEL", "HAS_VENDOR", "HAS_MODEL_FAMILY", "HAS_PLATFORM", "IMPLEMENTS", "GENERATIVE_PARADIGM"],
    defaultOn: false,
  },
];

export function getDefaultEdgeTypes(): Set<EdgeType> {
  const set = new Set<EdgeType>();
  for (const cat of EDGE_TYPE_CATEGORIES) {
    if (cat.defaultOn) {
      for (const t of cat.types) set.add(t);
    }
  }
  return set;
}
