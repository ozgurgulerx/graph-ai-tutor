import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Concept,
  ConceptMerge,
  ContextPackRadius,
  DraftRevision,
  GraphResponse,
  PostConceptMergePreviewResponse,
  QuizItem,
  Source
} from "@graph-ai-tutor/shared";

import {
  attachConceptSource,
  postConceptLocalSource,
  getConceptMerges,
  getConceptDraftRevisions,
  getConceptQuizzes,
  getConceptSources,
  postConceptMergeApply,
  postConceptMergePreview,
  postConceptMergeUndo,
  postConceptDistill,
  postDraftRevisionApply,
  postDraftRevisionReject,
  postDraftRevisionRevert,
  postGenerateConceptQuizzes,
  postContextPack,
  postGenerateContext,
  postUpdateContext,
} from "./api/client";
import { LearningPathSection } from "./LearningPathSection";
import { ConceptNoteSection } from "./ConceptNoteSection";

export type ConceptTab = "summary" | "note" | "sources" | "quizzes";
export type ConceptWorkspaceMode =
  | "full"
  | "overview"
  | "note"
  | "sources"
  | "quizzes"
  | "advanced";

export type SaveInput = {
  id: string;
  l0: string | null;
  l1: string[];
  l2: string[];
};

export type ConceptWorkspaceProps = {
  concept: Concept;
  onSave: (input: SaveInput) => Promise<Concept>;
  onConceptUpdated: (concept: Concept) => void;
  graph?: GraphResponse | null;
  onOpenConcept?: (conceptId: string) => void;
  onOpenUpstreamPathConcept?: (conceptId: string) => void;
  upstreamFocusConceptId?: string | null;
  onOpenSource?: (sourceId: string) => void;
  onShowContextPack?: (markdown: string, fileName: string) => void;
  sourcesRefreshToken?: number;
  onGraphUpdated?: () => void;
  mode?: ConceptWorkspaceMode;
  hideHeader?: boolean;
  hideSubTabs?: boolean;
  autoGenerateQuizzesToken?: number;
};

export function ConceptWorkspace(props: ConceptWorkspaceProps) {
  const concept = props.concept;
  const mode = props.mode ?? "full";
  const showHeader = props.hideHeader ? false : true;
  const showSubTabs = props.hideSubTabs ? false : mode === "full";

  const forcedTab: ConceptTab =
    mode === "note"
      ? "note"
      : mode === "sources"
      ? "sources"
      : mode === "quizzes"
      ? "quizzes"
      : "summary";
  const showSummaryOverview = mode === "full" || mode === "overview";
  const showSummaryAdvanced = mode === "full" || mode === "advanced";

  const [activeTab, setActiveTab] = useState<ConceptTab>("summary");
  const activeViewTab = mode === "full" ? activeTab : forcedTab;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draftL0, setDraftL0] = useState(concept.l0 ?? "");
  const [draftL1, setDraftL1] = useState(concept.l1.join("\n"));
  const [draftL2, setDraftL2] = useState(concept.l2.join("\n"));

  useEffect(() => {
    if (mode === "full") setActiveTab("summary");
    setEditing(false);
    setSaving(false);
    setSaveError(null);
    setDraftL0(concept.l0 ?? "");
    setDraftL1(concept.l1.join("\n"));
    setDraftL2(concept.l2.join("\n"));
  }, [concept.id, concept.l0, concept.l1, concept.l2, mode]);

  const l1Lines = useMemo(() => {
    return draftL1
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [draftL1]);

  const l2Lines = useMemo(() => {
    return draftL2
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [draftL2]);

  const openPathConcept = props.onOpenUpstreamPathConcept ?? props.onOpenConcept;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await props.onSave({
        id: concept.id,
        l0: draftL0.trim() ? draftL0 : null,
        l1: l1Lines,
        l2: l2Lines
      });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save concept");
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setDraftL0(concept.l0 ?? "");
    setDraftL1(concept.l1.join("\n"));
    setDraftL2(concept.l2.join("\n"));
    setEditing(false);
    setSaveError(null);
  }

  const [revisions, setRevisions] = useState<DraftRevision[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);

  const [distilling, setDistilling] = useState(false);
  const [distillError, setDistillError] = useState<string | null>(null);

  const [revisionActionLoading, setRevisionActionLoading] = useState(false);
  const [revisionActionError, setRevisionActionError] = useState<string | null>(null);

  const latestDraftRevision = useMemo(() => {
    return (revisions ?? []).find((r) => r.status === "draft") ?? null;
  }, [revisions]);

  async function refreshRevisions() {
    setRevisionsLoading(true);
    setRevisionsError(null);
    try {
      const res = await getConceptDraftRevisions(concept.id);
      setRevisions(res.revisions);
    } catch (err) {
      setRevisionsError(err instanceof Error ? err.message : "Failed to load draft revisions");
    } finally {
      setRevisionsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setRevisionsLoading(true);
    setRevisionsError(null);
    setRevisions(null);
    setDistillError(null);
    setRevisionActionError(null);
    setContextPackError(null);

    getConceptDraftRevisions(concept.id)
      .then((res) => {
        if (cancelled) return;
        setRevisions(res.revisions);
      })
      .catch((err) => {
        if (cancelled) return;
        setRevisionsError(err instanceof Error ? err.message : "Failed to load draft revisions");
      })
      .finally(() => {
        if (cancelled) return;
        setRevisionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [concept.id]);

  async function distill() {
    setDistilling(true);
    setDistillError(null);
    setRevisionActionError(null);
    try {
      const res = await postConceptDistill(concept.id);
      setRevisions((prev) => {
        const list = prev ?? [];
        if (list.some((r) => r.id === res.revision.id)) return list;
        return [res.revision, ...list];
      });
    } catch (err) {
      setDistillError(err instanceof Error ? err.message : "Failed to distill summaries");
    } finally {
      setDistilling(false);
    }
  }

  async function applyDraftRevision(revisionId: string) {
    setRevisionActionLoading(true);
    setRevisionActionError(null);
    try {
      const res = await postDraftRevisionApply(concept.id, revisionId);
      props.onConceptUpdated(res.concept);
      await refreshRevisions();
    } catch (err) {
      setRevisionActionError(err instanceof Error ? err.message : "Failed to apply draft revision");
    } finally {
      setRevisionActionLoading(false);
    }
  }

  async function rejectDraftRevision(revisionId: string) {
    setRevisionActionLoading(true);
    setRevisionActionError(null);
    try {
      await postDraftRevisionReject(concept.id, revisionId);
      await refreshRevisions();
    } catch (err) {
      setRevisionActionError(
        err instanceof Error ? err.message : "Failed to reject draft revision"
      );
    } finally {
      setRevisionActionLoading(false);
    }
  }

  async function revertRevision(revisionId: string) {
    setRevisionActionLoading(true);
    setRevisionActionError(null);
    try {
      const res = await postDraftRevisionRevert(concept.id, revisionId);
      props.onConceptUpdated(res.concept);
      await refreshRevisions();
    } catch (err) {
      setRevisionActionError(err instanceof Error ? err.message : "Failed to revert revision");
    } finally {
      setRevisionActionLoading(false);
    }
  }

  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    setSourcesError(null);
    setSources(null);

    getConceptSources(concept.id)
      .then((res) => {
        if (cancelled) return;
        setSources(res.sources);
      })
      .catch((err) => {
        if (cancelled) return;
        setSourcesError(err instanceof Error ? err.message : "Failed to load sources");
      })
      .finally(() => {
        if (cancelled) return;
        setSourcesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [concept.id, props.sourcesRefreshToken]);

  const [creatingLocalSource, setCreatingLocalSource] = useState(false);
  const [createLocalSourceError, setCreateLocalSourceError] = useState<string | null>(null);
  const onOpenSource = props.onOpenSource;

  const createLocalSource = useCallback(async () => {
    setCreatingLocalSource(true);
    setCreateLocalSourceError(null);
    try {
      const res = await postConceptLocalSource(concept.id, {});
      setSources((prev) => {
        const list = prev ?? [];
        if (list.some((s) => s.id === res.source.id)) return list;
        return [...list, res.source];
      });
      onOpenSource?.(res.source.id);
    } catch (err) {
      setCreateLocalSourceError(
        err instanceof Error ? err.message : "Failed to create local source"
      );
    } finally {
      setCreatingLocalSource(false);
    }
  }, [concept.id, onOpenSource]);

  const [attachUrl, setAttachUrl] = useState("");
  const [attachTitle, setAttachTitle] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  async function attach() {
    const url = attachUrl.trim();
    if (!url) return;
    setAttaching(true);
    setAttachError(null);
    try {
      const res = await attachConceptSource(concept.id, {
        url,
        title: attachTitle.trim() ? attachTitle.trim() : null
      });
      setSources((prev) => {
        const list = prev ?? [];
        if (list.some((s) => s.id === res.source.id)) return list;
        return [...list, res.source];
      });
      setAttachUrl("");
      setAttachTitle("");
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to attach source");
    } finally {
      setAttaching(false);
    }
  }

  const [quizzes, setQuizzes] = useState<QuizItem[] | null>(null);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizzesGenerating, setQuizzesGenerating] = useState(false);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const lastAutoGenerateQuizzesTokenRef = useRef<number | null>(null);

  useEffect(() => {
    setQuizzes(null);
    setQuizzesLoading(false);
    setQuizzesGenerating(false);
    setQuizzesError(null);
    lastAutoGenerateQuizzesTokenRef.current = null;
  }, [concept.id]);

  async function loadQuizzes() {
    setQuizzesLoading(true);
    setQuizzesError(null);
    try {
      const res = await getConceptQuizzes(concept.id);
      setQuizzes(res.quizzes);
    } catch (err) {
      setQuizzesError(err instanceof Error ? err.message : "Failed to load quizzes");
    } finally {
      setQuizzesLoading(false);
    }
  }

  async function generateQuizzes() {
    setQuizzesGenerating(true);
    setQuizzesError(null);
    try {
      const res = await postGenerateConceptQuizzes(concept.id, { count: 6 });
      setQuizzes(res.quizzes);
    } catch (err) {
      setQuizzesError(err instanceof Error ? err.message : "Failed to generate quizzes");
    } finally {
      setQuizzesGenerating(false);
    }
  }

  useEffect(() => {
    const token = props.autoGenerateQuizzesToken;
    if (typeof token !== "number" || token <= 0) return;
    if (token === lastAutoGenerateQuizzesTokenRef.current) return;
    lastAutoGenerateQuizzesTokenRef.current = token;
    void generateQuizzes();
    // generateQuizzes is intentionally omitted to keep this trigger token-driven only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoGenerateQuizzesToken, concept.id]);

  function parseDuplicateIds(input: string): string[] {
    const tokens = input
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }

  const [mergeInput, setMergeInput] = useState("");
  const [mergePreview, setMergePreview] = useState<PostConceptMergePreviewResponse | null>(null);
  const [mergeHistory, setMergeHistory] = useState<ConceptMerge[] | null>(null);
  const [mergeHistoryLoading, setMergeHistoryLoading] = useState(false);
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false);
  const [mergeActionLoading, setMergeActionLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // LLM concept context state
  const [contextGenerating, setContextGenerating] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextEditing, setContextEditing] = useState(false);
  const [contextDraft, setContextDraft] = useState("");
  const [contextSaving, setContextSaving] = useState(false);

  useEffect(() => {
    setContextEditing(false);
    setContextError(null);
    setContextGenerating(false);
    setContextSaving(false);
  }, [concept.id]);

  async function handleGenerateContext() {
    setContextGenerating(true);
    setContextError(null);
    try {
      const res = await postGenerateContext(concept.id);
      props.onConceptUpdated(res.concept);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : "Failed to generate context");
    } finally {
      setContextGenerating(false);
    }
  }

  function startEditContext() {
    setContextDraft(concept.context ?? "");
    setContextEditing(true);
  }

  async function saveContext() {
    setContextSaving(true);
    setContextError(null);
    try {
      const res = await postUpdateContext(concept.id, contextDraft);
      props.onConceptUpdated(res.concept);
      setContextEditing(false);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : "Failed to save context");
    } finally {
      setContextSaving(false);
    }
  }

  // Context pack state
  const [contextPackRadius, setContextPackRadius] = useState<ContextPackRadius>("1-hop");
  const [contextPackIncludeQuiz, setContextPackIncludeQuiz] = useState(false);
  const [contextPackGenerating, setContextPackGenerating] = useState(false);
  const [contextPackError, setContextPackError] = useState<string | null>(null);

  async function generateContextPackAction() {
    setContextPackGenerating(true);
    setContextPackError(null);
    try {
      const res = await postContextPack(concept.id, {
        radius: contextPackRadius,
        includeCode: false,
        includeQuiz: contextPackIncludeQuiz
      });
      props.onShowContextPack?.(res.markdown, res.fileName);
    } catch (err) {
      setContextPackError(
        err instanceof Error ? err.message : "Failed to generate context pack"
      );
    } finally {
      setContextPackGenerating(false);
    }
  }

  const refreshMerges = useCallback(async () => {
    setMergeHistoryLoading(true);
    setMergeError(null);
    try {
      const res = await getConceptMerges(concept.id);
      setMergeHistory(res.merges);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Failed to load merge history");
    } finally {
      setMergeHistoryLoading(false);
    }
  }, [concept.id]);

  useEffect(() => {
    setMergeInput("");
    setMergePreview(null);
    setMergeHistory(null);
    void refreshMerges();
  }, [concept.id, refreshMerges]);

  async function previewMerge() {
    const duplicateIds = parseDuplicateIds(mergeInput).filter((id) => id !== concept.id);
    if (duplicateIds.length === 0) {
      setMergeError("Enter at least one duplicate concept id.");
      return;
    }

    setMergePreviewLoading(true);
    setMergeError(null);
    try {
      const res = await postConceptMergePreview({
        canonicalId: concept.id,
        duplicateIds
      });
      setMergePreview(res);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge preview failed");
      setMergePreview(null);
    } finally {
      setMergePreviewLoading(false);
    }
  }

  async function applyMerge() {
    const duplicateIds = parseDuplicateIds(mergeInput).filter((id) => id !== concept.id);
    if (duplicateIds.length === 0) {
      setMergeError("Enter at least one duplicate concept id.");
      return;
    }

    setMergeActionLoading(true);
    setMergeError(null);
    try {
      await postConceptMergeApply({
        canonicalId: concept.id,
        duplicateIds
      });
      setMergeInput("");
      setMergePreview(null);
      await refreshMerges();
      props.onGraphUpdated?.();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMergeActionLoading(false);
    }
  }

  async function undoMerge(mergeId: string) {
    setMergeActionLoading(true);
    setMergeError(null);
    try {
      await postConceptMergeUndo(mergeId);
      await refreshMerges();
      props.onGraphUpdated?.();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setMergeActionLoading(false);
    }
  }

  return (
    <div className="conceptWorkspace">
      {showHeader ? (
        <div className="conceptHeader">
          <div>
            <h3 className="conceptTitle" data-testid="concept-title">
              {concept.title}
            </h3>
            <div className="conceptMeta">
              <span>
                Type: {concept.kind}
                {concept.module ? ` • Module: ${concept.module}` : ""}
              </span>
            </div>
          </div>

          <div className="buttonRow">
            {!editing ? (
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={save}
                  disabled={saving}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showSubTabs ? (
        <div className="conceptSubTabs" data-testid="concept-sub-tabs">
          {(["summary", "note", "sources", "quizzes"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab${activeTab === tab ? " tabActive" : ""}`}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="errorText">
          {saveError}
        </p>
      ) : null}

      {activeViewTab === "summary" ? (
      <>
      {showSummaryOverview ? (
      <>
      {!showHeader ? (
        <div className="buttonRow conceptInlineEditorActions">
          {!editing ? (
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                className="primaryButton"
                onClick={save}
                disabled={saving}
              >
                Save
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ) : null}

      <p className="mutedText helperText" data-testid="summary-levels-help">
        L0 = one-line definition, L1 = key bullets, L2 = deeper mechanism/steps. These are
        summary levels, not graph neighborhood depth.
      </p>
      <div className="conceptSection" aria-label="Summaries">
        <div className="sectionTitle">L0</div>
        <p className="mutedText helperText">One-line definition (quick recall).</p>
        {!editing ? (
          concept.l0 ? (
            <p>{concept.l0}</p>
          ) : (
            <p className="mutedText">(No L0 yet)</p>
          )
        ) : (
          <textarea
            className="textInput"
            rows={3}
            value={draftL0}
            onChange={(e) => setDraftL0(e.target.value)}
            aria-label="Edit L0"
          />
        )}
      </div>

      <div className="conceptSection" aria-label="Bullets">
        <div className="sectionTitle">L1</div>
        <p className="mutedText helperText">Key bullets (what matters most).</p>
        {!editing ? (
          concept.l1.length > 0 ? (
            <ul className="bullets">
              {concept.l1.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="mutedText">(No L1 yet)</p>
          )
        ) : (
          <>
            <textarea
              className="textInput"
              rows={6}
              value={draftL1}
              onChange={(e) => setDraftL1(e.target.value)}
              aria-label="Edit L1 bullets"
            />
            <p className="mutedText helperText">One bullet per line.</p>
          </>
        )}
      </div>

      <div className="conceptSection" aria-label="Mechanism">
        <div className="sectionTitle">L2</div>
        <p className="mutedText helperText">Deeper mechanism/steps (how it works).</p>
        {!editing ? (
          concept.l2.length > 0 ? (
            <ol className="bullets">
              {concept.l2.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="mutedText">(No L2 yet)</p>
          )
        ) : (
          <>
            <textarea
              className="textInput"
              rows={8}
              value={draftL2}
              onChange={(e) => setDraftL2(e.target.value)}
              aria-label="Edit L2 steps"
            />
            <p className="mutedText helperText">One step per line.</p>
          </>
        )}
      </div>

      {props.graph && props.onOpenConcept ? (
        <LearningPathSection
          graph={props.graph}
          conceptId={concept.id}
          onOpenConcept={props.onOpenConcept}
          onOpenPathConcept={openPathConcept}
          highlightedUpstreamConceptId={props.upstreamFocusConceptId}
        />
      ) : null}
      </>
      ) : null}

      {showSummaryAdvanced ? (
      <>
      <div className="conceptSection" aria-label="Context" data-testid="concept-context-section">
        <div className="sectionTitle">Context</div>

        {!contextEditing ? (
          concept.context ? (
            <div className="conceptContextDisplay">
              <p className="conceptContextText">{concept.context}</p>
              <div className="buttonRow">
                <button
                  type="button"
                  className="ghostButton"
                  onClick={startEditContext}
                  data-testid="context-edit"
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={handleGenerateContext}
                  disabled={contextGenerating}
                  data-testid="context-regenerate"
                >
                  {contextGenerating ? "Regenerating..." : "Regenerate"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mutedText">(No context generated yet)</p>
              <div className="buttonRow">
                <button
                  type="button"
                  className="primaryButton"
                  onClick={handleGenerateContext}
                  disabled={contextGenerating}
                  data-testid="context-generate"
                >
                  {contextGenerating ? "Generating..." : "Generate Context"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div>
            <textarea
              className="textInput"
              rows={8}
              value={contextDraft}
              onChange={(e) => setContextDraft(e.target.value)}
              aria-label="Edit context"
              data-testid="context-textarea"
            />
            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={saveContext}
                disabled={contextSaving}
                data-testid="context-save"
              >
                {contextSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={() => setContextEditing(false)}
                disabled={contextSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {contextError ? (
          <p role="alert" className="errorText">
            {contextError}
          </p>
        ) : null}
      </div>

      <div className="conceptSection" aria-label="Context Pack">
        <div className="sectionTitle">Context Pack</div>

        <label className="mutedText" htmlFor="context-pack-radius">
          Radius
        </label>
        <select
          id="context-pack-radius"
          className="searchInput"
          value={contextPackRadius}
          onChange={(e) =>
            setContextPackRadius(e.target.value as ContextPackRadius)
          }
        >
          <option value="1-hop">1 hop</option>
          <option value="2-hop">2 hops</option>
          <option value="prereq-path">Prereq path</option>
        </select>

        <label className="mutedText">
          <input
            type="checkbox"
            checked={contextPackIncludeQuiz}
            onChange={(e) => setContextPackIncludeQuiz(e.target.checked)}
          />{" "}
          Include quizzes
        </label>

        <div className="buttonRow">
          <button
            type="button"
            className="primaryButton"
            onClick={generateContextPackAction}
            disabled={contextPackGenerating}
            data-testid="context-pack-generate"
          >
            {contextPackGenerating ? "Generating..." : "Generate context"}
          </button>
        </div>

        {contextPackError ? (
          <p role="alert" className="errorText">
            {contextPackError}
          </p>
        ) : null}
      </div>

      <div className="conceptSection" aria-label="Distillation">
        <div className="sectionTitle">Distill (L1/L2)</div>

        <div className="buttonRow">
          <button
            type="button"
            className="secondaryButton"
            onClick={distill}
            disabled={editing || saving || distilling || revisionActionLoading}
            data-testid="distill-run"
          >
            {distilling ? "Distilling..." : "Distill"}
          </button>
          <button
            type="button"
            className="ghostButton"
            onClick={() => refreshRevisions()}
            disabled={revisionsLoading}
          >
            Refresh history
          </button>
        </div>

        {distillError ? (
          <p role="alert" className="errorText">
            {distillError}
          </p>
        ) : null}

        {revisionsError ? (
          <p role="alert" className="errorText">
            {revisionsError}
          </p>
        ) : null}

        {latestDraftRevision ? (
          <div className="revisionCard" data-testid="draft-revision">
            <div className="revisionMeta">
              Draft{" "}
              <code data-testid="draft-revision-id">{latestDraftRevision.id}</code>{" "}
              <span className="mutedText">
                • {new Date(latestDraftRevision.createdAt).toLocaleString()}
              </span>
            </div>

            <pre className="revisionDiff" data-testid="draft-revision-diff">
              {latestDraftRevision.diff}
            </pre>

            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={() => applyDraftRevision(latestDraftRevision.id)}
                disabled={revisionActionLoading || distilling}
                data-testid="draft-revision-apply"
              >
                Apply
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={() => rejectDraftRevision(latestDraftRevision.id)}
                disabled={revisionActionLoading || distilling}
                data-testid="draft-revision-reject"
              >
                Reject
              </button>
            </div>

            {revisionActionError ? (
              <p role="alert" className="errorText">
                {revisionActionError}
              </p>
            ) : null}
          </div>
        ) : revisionsLoading ? (
          <p className="mutedText">Loading revisions...</p>
        ) : (
          <p className="mutedText">(No pending draft revisions)</p>
        )}

        {revisions && revisions.length > 0 ? (
          <div className="revisionHistory" aria-label="Revision history">
            <div className="mutedText">History</div>
            <ul className="bullets">
              {revisions.map((r) => (
                <li key={r.id}>
                  <details>
                    <summary>
                      <code>{r.id}</code>{" "}
                      <span className="mutedText">
                        {r.kind} • {r.status} • {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </summary>
                    <pre className="revisionDiff">{r.diff}</pre>
                    {r.status === "applied" ? (
                      <div className="buttonRow">
                        <button
                          type="button"
                          className="dangerButton"
                          onClick={() => revertRevision(r.id)}
                          disabled={revisionActionLoading}
                          data-testid={`revision-${r.id}-revert`}
                        >
                          Revert
                        </button>
                      </div>
                    ) : null}
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      </>
      ) : null}
      </>
      ) : null}

      {activeViewTab === "note" ? (
        <ConceptNoteSection
          conceptId={concept.id}
          conceptTitle={concept.title}
          noteSourceId={concept.noteSourceId ?? null}
          onNoteCreated={(sourceId) => {
            props.onConceptUpdated({ ...concept, noteSourceId: sourceId });
          }}
          onOpenConcept={props.onOpenConcept}
        />
      ) : null}

      {activeViewTab === "sources" ? (
      <div className="conceptSection" aria-label="Sources">
        <div className="sectionTitle">Sources</div>

        <div className="buttonRow">
          <button
            type="button"
            className="secondaryButton"
            onClick={createLocalSource}
            disabled={creatingLocalSource}
          >
            {creatingLocalSource ? "Creating..." : "New local note"}
          </button>
        </div>

        {createLocalSourceError ? (
          <p role="alert" className="errorText">
            {createLocalSourceError}
          </p>
        ) : null}

        <div className="bulletEditor">
          <label className="mutedText" htmlFor="source-url">
            Source URL
          </label>
          <input
            id="source-url"
            className="textInput"
            placeholder="https://…"
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
          />

          <label className="mutedText" htmlFor="source-title">
            Title (optional)
          </label>
          <input
            id="source-title"
            className="textInput"
            placeholder="e.g. KV cache notes"
            value={attachTitle}
            onChange={(e) => setAttachTitle(e.target.value)}
          />

          <div className="buttonRow">
            <button
              type="button"
              className="primaryButton"
              onClick={attach}
              disabled={attaching || !attachUrl.trim()}
            >
              Attach source
            </button>
          </div>

          {attachError ? (
            <p role="alert" className="errorText">
              {attachError}
            </p>
          ) : null}
        </div>

        {sourcesLoading ? <p className="mutedText">Loading sources...</p> : null}
        {sourcesError ? (
          <p role="alert" className="errorText">
            {sourcesError}
          </p>
        ) : null}

        {!sourcesLoading && !sourcesError ? (
          sources && sources.length > 0 ? (
            <ul className="bullets" aria-label="Attached sources">
              {sources.map((s) => (
                <li key={s.id}>
                  {s.url.startsWith("vault://") ? (
                    props.onOpenSource ? (
                      <button
                        type="button"
                        className="linkButton"
                        onClick={() => props.onOpenSource?.(s.id)}
                        data-testid={`source-open-${s.id}`}
                      >
                        {s.title ?? s.url}
                      </button>
                    ) : (
                      <span>{s.title ?? s.url}</span>
                    )
                  ) : (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title ?? s.url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mutedText">(No sources attached yet)</p>
          )
        ) : null}
      </div>
      ) : null}

      {activeViewTab === "quizzes" ? (
      <div className="conceptSection" aria-label="Quizzes">
        <div className="sectionTitle">Quizzes</div>

        <div className="buttonRow">
          <button
            type="button"
            className="secondaryButton"
            onClick={loadQuizzes}
            disabled={quizzesLoading || quizzesGenerating}
          >
            Load
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={generateQuizzes}
            disabled={quizzesGenerating}
          >
            Generate
          </button>
        </div>

        {quizzesError ? (
          <p role="alert" className="errorText">
            {quizzesError}
          </p>
        ) : null}

        {quizzesLoading ? <p className="mutedText">Loading quizzes...</p> : null}

        {quizzes !== null && !quizzesLoading ? (
          quizzes.length > 0 ? (
            <div className="quizList" data-testid="quiz-list">
              {quizzes.map((q) => (
                <div key={q.id} className="quizCard" data-testid={`quiz-${q.id}`}>
                  <div className="quizType">{q.type}</div>
                  <div className="quizPrompt">{q.prompt}</div>

                  {q.type === "CLOZE" ? (
                    <div className="mutedText">
                      Answer: {q.answer.blanks.join(", ")}
                    </div>
                  ) : q.type === "ORDERING_STEPS" ? (
                    <ol className="bullets">
                      {q.answer.orderedSteps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  ) : (
                    <>
                      <div className="mutedText">
                        Compare with: {q.answer.otherConceptTitle}
                      </div>
                      <div className="mutedText">
                        Similarities: {q.answer.similarities.join("; ")}
                      </div>
                      <div className="mutedText">
                        Differences: {q.answer.differences.join("; ")}
                      </div>
                    </>
                  )}

                  <div className="mutedText">Rubric: {q.rubric.explanation}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mutedText">(No quizzes yet)</p>
          )
        ) : quizzes === null ? (
          <p className="mutedText">(Not loaded)</p>
        ) : null}
      </div>
      ) : null}

      {activeViewTab === "summary" && showSummaryAdvanced ? (
      <div className="conceptSection" aria-label="Merge">
        <div className="sectionTitle">Merge duplicates</div>

        <p className="mutedText">
          Canonical: <code>{concept.id}</code>
        </p>

        <textarea
          className="textInput"
          rows={3}
          value={mergeInput}
          onChange={(e) => setMergeInput(e.target.value)}
          aria-label="Duplicate concept ids"
          placeholder="concept_… (one per line or comma-separated)"
        />

        <div className="buttonRow">
          <button
            type="button"
            className="secondaryButton"
            onClick={previewMerge}
            disabled={mergePreviewLoading || mergeActionLoading}
            data-testid="merge-preview"
          >
            {mergePreviewLoading ? "Previewing..." : "Preview"}
          </button>
          <button
            type="button"
            className="dangerButton"
            onClick={applyMerge}
            disabled={mergePreviewLoading || mergeActionLoading}
            data-testid="merge-apply"
          >
            {mergeActionLoading ? "Merging..." : "Merge"}
          </button>
        </div>

        {mergeError ? (
          <p role="alert" className="errorText">
            {mergeError}
          </p>
        ) : null}

        {mergePreview ? (
          <div className="mergePreview" data-testid="merge-preview-result">
            <div className="mutedText">
              Preview: {mergePreview.counts.edgesToRewire} edge(s) rewired,{" "}
              {mergePreview.counts.edgesToDelete} edge(s) deleted (self-loop),{" "}
              {mergePreview.counts.reviewItemsToUpdate} review item(s) updated,{" "}
              {mergePreview.counts.sourcesToMove} source link(s) moved.
            </div>
          </div>
        ) : null}

        <div className="mergeHistory">
          <div className="mutedText">Merge history</div>
          {mergeHistoryLoading ? (
            <p className="mutedText">Loading merges...</p>
          ) : mergeHistory && mergeHistory.length > 0 ? (
            <ul className="bullets" aria-label="Merge history list">
              {mergeHistory.map((m) => (
                <li key={m.id}>
                  <code>{m.id}</code>{" "}
                  <span className="mutedText">
                    • {new Date(m.createdAt).toLocaleString()}
                    {m.undoneAt ? ` • undone ${new Date(m.undoneAt).toLocaleString()}` : ""}
                  </span>
                  {!m.undoneAt ? (
                    <button
                      type="button"
                      className="ghostButton"
                      onClick={() => undoMerge(m.id)}
                      disabled={mergeActionLoading}
                      data-testid={`merge-${m.id}-undo`}
                    >
                      Undo
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mutedText">(No merges yet)</p>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
