import { useCallback, useEffect, useMemo, useState } from "react";

import type { GraphResponse, QuizItem, ReviewGrade } from "@graph-ai-tutor/shared";

import { getReviewDue, postReviewGrade } from "./api/client";

function getConceptTitle(graph: GraphResponse | null, conceptId: string): string {
  const hit = graph?.nodes.find((n) => n.id === conceptId);
  return hit?.title ?? conceptId;
}

export function ReviewPanel(props: {
  graph: GraphResponse | null;
  onOpenConcept: (conceptId: string) => void;
}) {
  const [items, setItems] = useState<QuizItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewDue(20);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load due review items");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = (items ?? [])[0] ?? null;

  const currentTitle = useMemo(() => {
    if (!current) return null;
    return getConceptTitle(props.graph, current.conceptId);
  }, [current, props.graph]);

  const currentDueCount = items?.length ?? 0;

  async function grade(grade: ReviewGrade) {
    if (!current) return;
    setGrading(true);
    setError(null);
    try {
      await postReviewGrade(current.id, { grade });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade review item");
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="inboxPanel" data-testid="review-panel">
      <div className="inboxHeader">
        <h3 className="paneTitle">Review</h3>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => refresh()}
          disabled={loading || grading}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mutedText">Loading due items...</p>
      ) : !current ? (
        <p className="mutedText">(No due items)</p>
      ) : (
        <>
          <div className="mutedText">
            Due: {currentDueCount} • Ease: {current.ease.toFixed(2)} • Interval: {current.interval}d
          </div>

          <div className="inboxItem">
            <div className="inboxItemTop">
              <div>
                <div className="inboxItemTitle">
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => props.onOpenConcept(current.conceptId)}
                  >
                    {currentTitle}
                  </button>
                </div>
                <div className="mutedText inboxItemMeta">{current.type}</div>
              </div>
            </div>

            <div className="conceptSection">
              <div className="evidenceChunk">{current.prompt}</div>
            </div>

            <div className="buttonRow">
              <button
                type="button"
                className="dangerButton"
                onClick={() => grade("wrong")}
                disabled={grading}
              >
                Wrong
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => grade("partial")}
                disabled={grading}
              >
                Partial
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => grade("correct")}
                disabled={grading}
              >
                Correct
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

