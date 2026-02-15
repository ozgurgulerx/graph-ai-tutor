import { useCallback, useState } from "react";

import type {
  GraphResponse,
  TrainingSession,
  TrainingSessionItem,
  TrainingQuizItem
} from "@graph-ai-tutor/shared";

import {
  postCreateTrainingSession,
  postSubmitTrainingAnswer,
  postCompleteTrainingSession
} from "./api/client";

type TrainingState = "idle" | "loading" | "active" | "review";

function getConceptTitle(graph: GraphResponse | null, conceptId: string): string {
  const hit = graph?.nodes.find((n) => n.id === conceptId);
  return hit?.title ?? conceptId;
}

function questionTypeBadge(type: string): string {
  switch (type) {
    case "MECHANISM_TRACE":
      return "Mechanism Trace";
    case "FAILURE_MODE":
      return "Failure Mode";
    case "CONTRAST_EXPLAIN":
      return "Contrast & Explain";
    case "CODE_REASONING":
      return "Code Reasoning";
    default:
      return type;
  }
}

export function TrainingPanel(props: {
  open: boolean;
  onClose: () => void;
  graph: GraphResponse | null;
  conceptIds?: string[];
}) {
  const onClose = props.onClose;
  const [state, setState] = useState<TrainingState>("idle");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [items, setItems] = useState<TrainingSessionItem[]>([]);
  const [questions, setQuestions] = useState<TrainingQuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ grade: string; feedback: string } | null>(
    null
  );

  const startSession = useCallback(async () => {
    setState("loading");
    setError(null);
    setLastFeedback(null);
    setCurrentIndex(0);
    setUserAnswer("");

    try {
      const res = await postCreateTrainingSession({
        conceptIds: props.conceptIds
      });
      setSession(res.session);
      setItems(res.items);
      setQuestions(res.questions);
      setState("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create training session");
      setState("idle");
    }
  }, [props.conceptIds]);

  const submitAnswer = useCallback(async () => {
    if (!session || !items[currentIndex] || !userAnswer.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const currentItem = items[currentIndex]!;
      const res = await postSubmitTrainingAnswer(session.id, currentItem.id, {
        answer: userAnswer.trim()
      });

      // Update the item in local state
      setItems((prev) =>
        prev.map((it) => (it.id === currentItem.id ? res.item : it))
      );

      setLastFeedback({
        grade: res.item.grade ?? "wrong",
        feedback: res.item.feedback ?? "No feedback available."
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }, [session, items, currentIndex, userAnswer]);

  const nextQuestion = useCallback(() => {
    setLastFeedback(null);
    setUserAnswer("");
    if (currentIndex + 1 >= items.length) {
      // Session complete
      if (session) {
        void postCompleteTrainingSession(session.id).then((res) => {
          setSession(res.session);
        });
      }
      setState("review");
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, items.length, session]);

  const close = useCallback(() => {
    setState("idle");
    setSession(null);
    setItems([]);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswer("");
    setError(null);
    setLastFeedback(null);
    onClose();
  }, [onClose]);

  if (!props.open) return null;

  const currentItem = items[currentIndex] ?? null;
  const currentQuestion = currentItem
    ? questions.find((q) => q.id === currentItem.reviewItemId) ?? null
    : null;

  const progress = items.length > 0 ? ((currentIndex + (lastFeedback ? 1 : 0)) / items.length) * 100 : 0;

  const gradedItems = items.filter((it) => it.grade !== null);
  const correctCount = gradedItems.filter((it) => it.grade === "correct").length;
  const partialCount = gradedItems.filter((it) => it.grade === "partial").length;
  const wrongCount = gradedItems.filter((it) => it.grade === "wrong").length;

  return (
    <div
      className="trainingOverlay"
      data-testid="training-panel"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="trainingPanel">
        <div className="trainingHeader">
          <h2>Training Session</h2>
          <button type="button" className="ghostButton" onClick={close}>
            Close
          </button>
        </div>

        {error ? (
          <p role="alert" className="errorText">
            {error}
          </p>
        ) : null}

        {state === "idle" ? (
          <div className="trainingIdle">
            <p className="mutedText">
              Start a focused training session to deepen your understanding.
            </p>
            <button type="button" className="primaryButton" onClick={startSession}>
              Start Training
            </button>
          </div>
        ) : state === "loading" ? (
          <div className="trainingLoading">
            <p className="mutedText">Generating training questions...</p>
          </div>
        ) : state === "active" && currentQuestion ? (
          <div className="trainingActive">
            <div className="trainingProgress">
              <div className="trainingProgressBar" style={{ width: `${progress}%` }} />
            </div>
            <div className="trainingMeta">
              <span className="trainingTypeBadge" data-testid="question-type-badge">
                {questionTypeBadge(currentQuestion.type)}
              </span>
              <span className="mutedText">
                Question {currentIndex + 1} of {items.length}
              </span>
              {currentQuestion.conceptId ? (
                <span className="mutedText">
                  {getConceptTitle(props.graph, currentQuestion.conceptId)}
                </span>
              ) : null}
            </div>

            <div className="trainingPrompt">{currentQuestion.prompt}</div>

            {!lastFeedback ? (
              <>
                <textarea
                  className="trainingTextarea"
                  data-testid="training-answer-input"
                  placeholder="Type your answer..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  rows={6}
                  disabled={submitting}
                />
                <div className="buttonRow">
                  <button
                    type="button"
                    className="primaryButton"
                    onClick={submitAnswer}
                    disabled={submitting || !userAnswer.trim()}
                    data-testid="training-submit-btn"
                  >
                    {submitting ? "Grading..." : "Submit"}
                  </button>
                </div>
              </>
            ) : (
              <div className="trainingFeedback" data-testid="training-feedback">
                <div
                  className={`trainingGradeBadge trainingGrade-${lastFeedback.grade}`}
                  data-testid="training-grade"
                >
                  {lastFeedback.grade.charAt(0).toUpperCase() + lastFeedback.grade.slice(1)}
                </div>
                <p className="trainingFeedbackText">{lastFeedback.feedback}</p>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={nextQuestion}
                  data-testid="training-next-btn"
                >
                  {currentIndex + 1 >= items.length ? "View Summary" : "Next Question"}
                </button>
              </div>
            )}
          </div>
        ) : state === "review" ? (
          <div className="trainingReview" data-testid="training-summary">
            <h3>Session Complete</h3>
            <div className="trainingSummaryStats">
              <div className="trainingSummaryStat">
                <span className="trainingSummaryLabel">Correct</span>
                <span className="trainingSummaryValue trainingGrade-correct">{correctCount}</span>
              </div>
              <div className="trainingSummaryStat">
                <span className="trainingSummaryLabel">Partial</span>
                <span className="trainingSummaryValue trainingGrade-partial">{partialCount}</span>
              </div>
              <div className="trainingSummaryStat">
                <span className="trainingSummaryLabel">Wrong</span>
                <span className="trainingSummaryValue trainingGrade-wrong">{wrongCount}</span>
              </div>
            </div>
            <div className="buttonRow">
              <button type="button" className="primaryButton" onClick={startSession}>
                Start New Session
              </button>
              <button type="button" className="secondaryButton" onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <p className="mutedText">No questions available.</p>
        )}
      </div>
    </div>
  );
}
