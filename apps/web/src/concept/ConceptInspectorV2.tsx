import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  EDGE_TYPE_CATEGORIES,
  type ConceptSummary,
  type EdgeType,
  type PostDraftEdgeRequest
} from "@graph-ai-tutor/shared";

import {
  ConceptWorkspace,
  type ConceptWorkspaceProps
} from "../ConceptWorkspace";
import { getUniversalSearch } from "../api/client";
import { ConceptNotesV2 } from "./ConceptNotesV2";

type SectionKey =
  | "overview"
  | "relationships"
  | "notes"
  | "quizzes"
  | "sources"
  | "advanced";

type ConceptInspectorV2Props = Pick<
  ConceptWorkspaceProps,
  | "concept"
  | "onSave"
  | "onConceptUpdated"
  | "graph"
  | "onOpenConcept"
  | "onOpenUpstreamPathConcept"
  | "upstreamFocusConceptId"
  | "onOpenSource"
  | "onShowContextPack"
  | "sourcesRefreshToken"
  | "onGraphUpdated"
> & {
  actionRequest?: {
    type: "new_note" | "generate_quiz" | "add_relation";
    token: number;
  } | null;
  onOpenTutorTab?: () => void;
  onHoverRelationship?: (input: { edgeId: string; conceptId: string } | null) => void;
  onSelectRelationship?: (input: { edgeId: string; conceptId: string }) => void;
  onCreateDraftRelation?: (input: PostDraftEdgeRequest) => Promise<void>;
};

type RelationshipRow = {
  edgeId: string;
  edgeType: EdgeType;
  relatedConceptId: string;
  relatedConceptTitle: string;
  confidence: number | null;
};

type TargetConceptOption = {
  id: string;
  title: string;
  kind: ConceptSummary["kind"];
  module: string | null;
};

type OtherRelationGroup =
  | "Structural"
  | "Dependency"
  | "Comparison"
  | "ML-specific"
  | "Security"
  | "Provenance"
  | "Other";

const OTHER_RELATION_GROUP_ORDER: readonly OtherRelationGroup[] = [
  "Structural",
  "Dependency",
  "Comparison",
  "ML-specific",
  "Security",
  "Provenance",
  "Other"
];

const EDGE_TYPE_GROUPS: Record<EdgeType, OtherRelationGroup | "prerequisite"> = {
  PREREQUISITE_OF: "prerequisite",
  PART_OF: "Structural",
  IS_A: "Structural",
  INSTANCE_OF: "Structural",
  HAS_MAJOR_AREA: "Structural",
  ENABLES: "Dependency",
  REQUIRES: "Dependency",
  DEPENDS_ON: "Dependency",
  PRODUCES: "Dependency",
  CONSUMES: "Dependency",
  CONTRASTS_WITH: "Comparison",
  CONFUSED_WITH: "Comparison",
  COMPETES_WITH: "Comparison",
  USED_IN: "ML-specific",
  OPTIMIZED_BY: "ML-specific",
  TRAINED_WITH: "ML-specific",
  EVALUATED_BY: "ML-specific",
  INSTRUMENTED_BY: "ML-specific",
  ADDRESSES_FAILURE_MODE: "ML-specific",
  ANSWERED_BY: "ML-specific",
  ADVANCES: "ML-specific",
  ATTACKED_BY: "Security",
  MITIGATED_BY: "Security",
  INTRODUCED_BY: "Provenance",
  POPULARIZED_BY: "Provenance",
  GOVERNED_BY: "Provenance",
  STANDARDIZED_BY: "Provenance",
  ALIGNED_WITH: "Provenance"
};

const DIRECTION_OPTIONS = [
  { id: "outbound", label: "Selected -> Target", value: "outbound" as const },
  { id: "inbound", label: "Target -> Selected", value: "inbound" as const }
];

function compareRelationships(a: RelationshipRow, b: RelationshipRow): number {
  return a.relatedConceptTitle.localeCompare(b.relatedConceptTitle) || a.edgeType.localeCompare(b.edgeType);
}

function edgeConfidence(edge: unknown): number | null {
  if (typeof edge !== "object" || edge === null) return null;
  const maybe = (edge as { confidence?: unknown }).confidence;
  if (typeof maybe !== "number" || !Number.isFinite(maybe)) return null;
  return maybe;
}

function confidenceLabel(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function AccordionSection(props: {
  id: SectionKey;
  title: string;
  open: boolean;
  onToggle: (id: SectionKey) => void;
  children: ReactNode;
}) {
  return (
    <section className="inspectorAccordionSection" data-testid={`inspector-section-${props.id}`}>
      <button
        type="button"
        className="inspectorAccordionToggle"
        onClick={() => props.onToggle(props.id)}
        aria-expanded={props.open}
      >
        <span>{props.open ? "▾" : "▸"}</span>
        {props.title}
      </button>
      {props.open ? <div className="inspectorAccordionBody">{props.children}</div> : null}
    </section>
  );
}

export function ConceptInspectorV2(props: ConceptInspectorV2Props) {
  const {
    concept,
    onCreateDraftRelation,
    onHoverRelationship,
    onOpenConcept,
    onSelectRelationship
  } = props;
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set(["overview"])
  );
  const [autoGenerateQuizzesToken, setAutoGenerateQuizzesToken] = useState(0);
  const [autoCreateNoteToken, setAutoCreateNoteToken] = useState(0);
  const [focusAddRelationToken, setFocusAddRelationToken] = useState(0);

  const graph = props.graph ?? null;
  const nodeById = useMemo(() => {
    const map = new Map<string, ConceptSummary>();
    for (const n of graph?.nodes ?? []) {
      map.set(n.id, n);
    }
    return map;
  }, [graph]);

  const relationships = useMemo(() => {
    const prerequisites: RelationshipRow[] = [];
    const dependents: RelationshipRow[] = [];
    const others = new Map<OtherRelationGroup, RelationshipRow[]>();
    for (const group of OTHER_RELATION_GROUP_ORDER) {
      others.set(group, []);
    }

    for (const edge of graph?.edges ?? []) {
      const isOutbound = edge.fromConceptId === concept.id;
      const isInbound = edge.toConceptId === concept.id;
      if (!isOutbound && !isInbound) continue;

      const relatedConceptId = isOutbound ? edge.toConceptId : edge.fromConceptId;
      const related = nodeById.get(relatedConceptId);
      if (!related) continue;

      const row: RelationshipRow = {
        edgeId: edge.id,
        edgeType: edge.type,
        relatedConceptId,
        relatedConceptTitle: related.title,
        confidence: edgeConfidence(edge)
      };

      if (edge.type === "PREREQUISITE_OF") {
        if (isInbound) prerequisites.push(row);
        else dependents.push(row);
        continue;
      }

      const group = EDGE_TYPE_GROUPS[edge.type];
      const bucket = group === "prerequisite" ? "Other" : group;
      others.get(bucket)?.push(row);
    }

    prerequisites.sort(compareRelationships);
    dependents.sort(compareRelationships);
    for (const group of OTHER_RELATION_GROUP_ORDER) {
      others.get(group)?.sort(compareRelationships);
    }

    return { prerequisites, dependents, others };
  }, [concept.id, graph?.edges, nodeById]);

  const [relationTargetQuery, setRelationTargetQuery] = useState("");
  const [relationTargetResults, setRelationTargetResults] = useState<TargetConceptOption[]>([]);
  const [relationTargetSearchLoading, setRelationTargetSearchLoading] = useState(false);
  const [relationTargetSearchError, setRelationTargetSearchError] = useState<string | null>(null);
  const [selectedTargetConceptId, setSelectedTargetConceptId] = useState<string | null>(null);
  const [relationEdgeType, setRelationEdgeType] = useState<EdgeType>("DEPENDS_ON");
  const [relationDirection, setRelationDirection] = useState<"outbound" | "inbound">("outbound");
  const [relationSubmitting, setRelationSubmitting] = useState(false);
  const [relationSubmitError, setRelationSubmitError] = useState<string | null>(null);
  const targetInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTarget = useMemo(() => {
    if (!selectedTargetConceptId) return null;
    return relationTargetResults.find((r) => r.id === selectedTargetConceptId) ??
      (() => {
        const node = nodeById.get(selectedTargetConceptId);
        if (!node) return null;
        return {
          id: node.id,
          title: node.title,
          kind: node.kind,
          module: node.module
        } satisfies TargetConceptOption;
      })() ??
      null;
  }, [nodeById, relationTargetResults, selectedTargetConceptId]);

  useEffect(() => {
    setOpenSections(new Set(["overview"]));
    setAutoGenerateQuizzesToken(0);
    setAutoCreateNoteToken(0);
    setFocusAddRelationToken(0);
    setRelationTargetQuery("");
    setRelationTargetResults([]);
    setRelationTargetSearchLoading(false);
    setRelationTargetSearchError(null);
    setSelectedTargetConceptId(null);
    setRelationDirection("outbound");
    setRelationEdgeType("DEPENDS_ON");
    setRelationSubmitting(false);
    setRelationSubmitError(null);
    onHoverRelationship?.(null);
  }, [concept.id, onHoverRelationship]);

  useEffect(() => {
    return () => onHoverRelationship?.(null);
  }, [onHoverRelationship]);

  useEffect(() => {
    const token = focusAddRelationToken;
    if (token <= 0) return;
    targetInputRef.current?.focus();
  }, [focusAddRelationToken]);

  useEffect(() => {
    const request = props.actionRequest;
    if (!request) return;

    const ensureSectionOpen = (section: SectionKey) => {
      setOpenSections((prev) => {
        if (prev.has(section)) return prev;
        const next = new Set(prev);
        next.add(section);
        return next;
      });
    };

    if (request.type === "new_note") {
      ensureSectionOpen("notes");
      setAutoCreateNoteToken((t) => t + 1);
      return;
    }

    if (request.type === "generate_quiz") {
      ensureSectionOpen("quizzes");
      setAutoGenerateQuizzesToken((t) => t + 1);
      return;
    }

    ensureSectionOpen("relationships");
    setFocusAddRelationToken((t) => t + 1);
  }, [props.actionRequest]);

  useEffect(() => {
    const query = relationTargetQuery.trim();
    if (query.length < 2) {
      setRelationTargetResults([]);
      setRelationTargetSearchLoading(false);
      setRelationTargetSearchError(null);
      return;
    }

    let cancelled = false;
    setRelationTargetSearchLoading(true);
    setRelationTargetSearchError(null);
    const timer = window.setTimeout(() => {
      getUniversalSearch(query, 10)
        .then((res) => {
          if (cancelled) return;
          const concepts = res.concepts
            .filter((c) => c.id !== concept.id)
            .map((c) => ({
              id: c.id,
              title: c.title,
              kind: c.kind,
              module: c.module
            } satisfies TargetConceptOption));
          setRelationTargetResults(concepts);
          if (selectedTargetConceptId && !concepts.some((c) => c.id === selectedTargetConceptId)) {
            setSelectedTargetConceptId(null);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setRelationTargetResults([]);
          setRelationTargetSearchError(
            err instanceof Error ? err.message : "Failed to search target concepts"
          );
        })
        .finally(() => {
          if (cancelled) return;
          setRelationTargetSearchLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [concept.id, relationTargetQuery, selectedTargetConceptId]);

  function toggleSection(section: SectionKey) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function openSection(section: SectionKey) {
    setOpenSections((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }

  async function submitDraftRelation() {
    if (!selectedTargetConceptId) {
      setRelationSubmitError("Select a target concept first.");
      return;
    }
    if (!onCreateDraftRelation) {
      setRelationSubmitError("Draft relation endpoint is unavailable.");
      return;
    }

    const fromConceptId =
      relationDirection === "outbound" ? concept.id : selectedTargetConceptId;
    const toConceptId =
      relationDirection === "outbound" ? selectedTargetConceptId : concept.id;

    setRelationSubmitting(true);
    setRelationSubmitError(null);
    try {
      await onCreateDraftRelation({
        fromConceptId,
        toConceptId,
        type: relationEdgeType,
        evidenceChunkIds: []
      });
      setRelationTargetQuery("");
      setRelationTargetResults([]);
      setSelectedTargetConceptId(null);
      setRelationDirection("outbound");
      setRelationEdgeType("DEPENDS_ON");
    } catch (err) {
      setRelationSubmitError(err instanceof Error ? err.message : "Failed to stage draft relation");
    } finally {
      setRelationSubmitting(false);
    }
  }

  function hoverRow(row: RelationshipRow) {
    onHoverRelationship?.({
      edgeId: row.edgeId,
      conceptId: row.relatedConceptId
    });
  }

  function clearHoverRow() {
    onHoverRelationship?.(null);
  }

  function clickRow(row: RelationshipRow) {
    onSelectRelationship?.({
      edgeId: row.edgeId,
      conceptId: row.relatedConceptId
    });
    if (!onSelectRelationship) {
      onOpenConcept?.(row.relatedConceptId);
    }
  }

  function renderRelationshipList(
    label: string,
    rows: RelationshipRow[],
    emptyText: string
  ) {
    return (
      <div className="relationshipsGroup" data-testid={`relationships-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
        <div className="sectionTitle">{label}</div>
        {rows.length === 0 ? (
          <p className="mutedText">{emptyText}</p>
        ) : (
          <ul className="relationshipsList">
            {rows.map((row) => (
              <li key={row.edgeId}>
                <button
                  type="button"
                  className="relationshipsRowButton"
                  onMouseEnter={() => hoverRow(row)}
                  onMouseLeave={clearHoverRow}
                  onFocus={() => hoverRow(row)}
                  onBlur={clearHoverRow}
                  onClick={() => clickRow(row)}
                  data-testid={`relationship-row-${row.edgeId}`}
                >
                  <span className="relationshipsRowTitle">{row.relatedConceptTitle}</span>
                  <span className="relationshipsRowMeta">
                    <span className="edgeTypeBadge">{row.edgeType}</span>
                    <span className="mutedText">confidence: {confidenceLabel(row.confidence)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const moduleLabel = concept.module ? ` • Module: ${concept.module}` : "";

  return (
    <div className="conceptInspectorV2" data-testid="concept-inspector-v2">
      <div className="conceptHeader conceptHeaderV2">
        <div>
          <h3 className="conceptTitle" data-testid="concept-title">
            {concept.title}
          </h3>
          <div className="conceptMeta">
            Type: {concept.kind}
            {moduleLabel}
          </div>
        </div>
        <div className="buttonRow conceptInspectorActions">
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              openSection("notes");
              setAutoCreateNoteToken((t) => t + 1);
            }}
          >
            + Note
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              openSection("quizzes");
              setAutoGenerateQuizzesToken((t) => t + 1);
            }}
          >
            Generate Quiz
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => props.onOpenTutorTab?.()}
            title="Open Tutor for this concept."
          >
            Ask Tutor
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              openSection("relationships");
              setFocusAddRelationToken((t) => t + 1);
            }}
            title="Add a draft relation through Inbox."
          >
            Add Relation
          </button>
        </div>
      </div>

      <AccordionSection
        id="overview"
        title="Overview"
        open={openSections.has("overview")}
        onToggle={toggleSection}
      >
        <ConceptWorkspace
          {...props}
          mode="overview"
          hideHeader
          hideSubTabs
        />
      </AccordionSection>

      <AccordionSection
        id="relationships"
        title="Relationships"
        open={openSections.has("relationships")}
        onToggle={toggleSection}
      >
        <div className="relationshipsPanel" data-testid="relationships-panel">
          {renderRelationshipList(
            "Prerequisites",
            relationships.prerequisites,
            "(No prerequisites found)"
          )}
          {renderRelationshipList(
            "Dependents",
            relationships.dependents,
            "(No dependents found)"
          )}

          {OTHER_RELATION_GROUP_ORDER.map((group) => (
            <div key={group}>
              {renderRelationshipList(
                group,
                relationships.others.get(group) ?? [],
                `(No ${group.toLowerCase()} relations)`
              )}
            </div>
          ))}

          <div className="relationshipsComposer" data-testid="relationships-composer">
            <div className="sectionTitle">Add Relation (draft)</div>

            <label className="mutedText" htmlFor="relation-target-query">
              Target concept
            </label>
            <input
              id="relation-target-query"
              ref={targetInputRef}
              className="textInput"
              placeholder="Search concepts..."
              value={relationTargetQuery}
              onChange={(e) => setRelationTargetQuery(e.target.value)}
              data-testid="relation-target-query"
            />

            {relationTargetSearchLoading ? <p className="mutedText">Searching…</p> : null}
            {relationTargetSearchError ? (
              <p role="alert" className="errorText">
                {relationTargetSearchError}
              </p>
            ) : null}

            {relationTargetResults.length > 0 ? (
              <ul className="relationshipsTargetResults" data-testid="relation-target-results">
                {relationTargetResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className={`relationshipsTargetOption${
                        selectedTargetConceptId === result.id ? " relationshipsTargetOptionActive" : ""
                      }`}
                      onClick={() => setSelectedTargetConceptId(result.id)}
                      data-testid={`relation-target-option-${result.id}`}
                    >
                      {result.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mutedText">
              Selected target: {selectedTarget ? selectedTarget.title : "(none)"}
            </p>

            <label className="mutedText" htmlFor="relation-edge-type">
              Edge type
            </label>
            <select
              id="relation-edge-type"
              className="searchInput"
              value={relationEdgeType}
              onChange={(e) => setRelationEdgeType(e.target.value as EdgeType)}
              data-testid="relation-edge-type"
            >
              {EDGE_TYPE_CATEGORIES.map((category) => (
                <optgroup key={category.id} label={category.label}>
                  {category.types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <fieldset className="relationshipsDirectionFieldset">
              <legend className="mutedText">Direction</legend>
              <div className="relationshipsDirectionRow">
                {DIRECTION_OPTIONS.map((option) => (
                  <label key={option.id} className="mutedText">
                    <input
                      type="radio"
                      name="relation-direction"
                      value={option.value}
                      checked={relationDirection === option.value}
                      onChange={() => setRelationDirection(option.value)}
                    />{" "}
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={() => void submitDraftRelation()}
                disabled={relationSubmitting || !selectedTargetConceptId}
                data-testid="relation-submit"
              >
                {relationSubmitting ? "Staging..." : "Add draft relation"}
              </button>
            </div>

            {relationSubmitError ? (
              <p role="alert" className="errorText">
                {relationSubmitError}
              </p>
            ) : null}
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        id="notes"
        title="Notes"
        open={openSections.has("notes")}
        onToggle={toggleSection}
      >
        <ConceptNotesV2
          conceptId={concept.id}
          conceptTitle={concept.title}
          noteSourceId={concept.noteSourceId ?? null}
          autoCreateToken={autoCreateNoteToken}
          onPrimaryNoteCreated={(sourceId) => {
            props.onConceptUpdated({ ...concept, noteSourceId: sourceId });
          }}
        />
      </AccordionSection>

      <AccordionSection
        id="quizzes"
        title="Quizzes"
        open={openSections.has("quizzes")}
        onToggle={toggleSection}
      >
        <ConceptWorkspace
          {...props}
          mode="quizzes"
          hideHeader
          hideSubTabs
          autoGenerateQuizzesToken={autoGenerateQuizzesToken}
        />
      </AccordionSection>

      <AccordionSection
        id="sources"
        title="Sources"
        open={openSections.has("sources")}
        onToggle={toggleSection}
      >
        <ConceptWorkspace
          {...props}
          mode="sources"
          hideHeader
          hideSubTabs
        />
      </AccordionSection>

      <AccordionSection
        id="advanced"
        title="Advanced"
        open={openSections.has("advanced")}
        onToggle={toggleSection}
      >
        <ConceptWorkspace
          {...props}
          mode="advanced"
          hideHeader
          hideSubTabs
        />
      </AccordionSection>
    </div>
  );
}
