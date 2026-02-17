import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { postSmartAddResolve, postSmartAddConfirm } from "./api/client";
import type {
  PostSmartAddResolveResponse,
  SmartAddProposedEdge
} from "@graph-ai-tutor/shared";

type Step = "input" | "loading" | "preview" | "confirming";

type EdgeState = {
  edge: SmartAddProposedEdge;
  accepted: boolean;
};

type SmartAddModalProps = {
  onCreated: (conceptId: string) => void;
  onClose: () => void;
};

export function SmartAddModal(props: SmartAddModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [proposal, setProposal] = useState<PostSmartAddResolveResponse | null>(null);
  const [edgeStates, setEdgeStates] = useState<EdgeState[]>([]);

  async function handleResolve() {
    const trimmed = title.trim();
    if (!trimmed) return;

    setStep("loading");
    setError(null);

    try {
      const res = await postSmartAddResolve({ title: trimmed });

      setProposal(res);
      setEdgeStates(
        res.edges.map((e) => ({
          edge: e,
          accepted: e.confidence >= 0.5
        }))
      );

      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStep("input");
    }
  }

  async function handleConfirm() {
    if (!proposal) return;

    setStep("confirming");
    setError(null);

    try {
      const acceptedEdges = edgeStates
        .filter((es) => es.accepted)
        .map((es) => ({
          existingConceptId: es.edge.existingConceptId,
          type: es.edge.type,
          direction: es.edge.direction
        }));

      const { concept } = await postSmartAddConfirm({
        title: title.trim(),
        kind: proposal.kind,
        l0: proposal.l0,
        l1: proposal.l1,
        module: proposal.module,
        edges: acceptedEdges
      });

      props.onCreated(concept.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed");
      setStep("preview");
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && step === "input") {
      e.preventDefault();
      void handleResolve();
    }
  }

  return (
    <div className="modalOverlay" data-testid="smart-add-modal" onClick={props.onClose}>
      <div
        className="modalContent smartAddModal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="paneTitle">Add concept</h3>

        {step === "input" || step === "loading" ? (
          <>
            <label className="mutedText" htmlFor="smart-add-title">
              Concept title
            </label>
            <input
              id="smart-add-title"
              className="textInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Retrieval-augmented generation"
              disabled={step === "loading"}
              maxLength={200}
              autoFocus
              data-testid="smart-add-title"
            />

            {error ? (
              <p role="alert" className="errorText">
                {error}
              </p>
            ) : null}

            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={handleResolve}
                disabled={step === "loading" || !title.trim()}
                data-testid="smart-add-resolve"
              >
                {step === "loading" ? "Analyzing..." : "Suggest placement"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={props.onClose}
                disabled={step === "loading"}
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {step === "preview" || step === "confirming" ? (
          <>
            {proposal ? (
              <div className="docIngestDeltaList" data-testid="smart-add-preview">
                <div className="docIngestDeltaItem">
                  <div className="docIngestDeltaHeader">
                    <span className="docIngestDeltaTitle">{title.trim()}</span>
                    <span className="docIngestKindBadge">{proposal.kind}</span>
                    {proposal.module ? (
                      <span className="docIngestKindBadge">{proposal.module}</span>
                    ) : null}
                  </div>
                  <div className="docIngestDeltaBody">
                    {proposal.l0 ? (
                      <p className="docIngestNewConceptL0">{proposal.l0}</p>
                    ) : null}
                    {proposal.l1.map((bullet, i) => (
                      <p key={i} className="docIngestNewBullet">+ {bullet}</p>
                    ))}
                  </div>
                </div>

                {edgeStates.length > 0 ? (
                  <>
                    <h4 className="docIngestSectionTitle">
                      Proposed edges ({edgeStates.length})
                    </h4>
                    {edgeStates.map((es, ei) => (
                      <div key={ei} className="docIngestDeltaItem">
                        <label className="docIngestCheckRow">
                          <input
                            type="checkbox"
                            checked={es.accepted}
                            onChange={(e) =>
                              setEdgeStates((prev) =>
                                prev.map((s, i) =>
                                  i === ei ? { ...s, accepted: e.target.checked } : s
                                )
                              )
                            }
                            disabled={step === "confirming"}
                          />
                          <span className="smartAddEdgeLabel">
                            {es.edge.direction === "from" ? (
                              <>
                                <strong>{title.trim()}</strong>
                                {" "}&mdash;{es.edge.type}&rarr;{" "}
                                {es.edge.existingConceptTitle}
                              </>
                            ) : (
                              <>
                                {es.edge.existingConceptTitle}
                                {" "}&mdash;{es.edge.type}&rarr;{" "}
                                <strong>{title.trim()}</strong>
                              </>
                            )}
                          </span>
                          <span className="docIngestConfidenceBadge">
                            {Math.round(es.edge.confidence * 100)}%
                          </span>
                        </label>
                        <details className="docIngestEvidence">
                          <summary className="mutedText">Why?</summary>
                          <p className="mutedText">{es.edge.evidence}</p>
                        </details>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="mutedText">No edge suggestions found.</p>
                )}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="errorText">
                {error}
              </p>
            ) : null}

            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={handleConfirm}
                disabled={step === "confirming"}
                data-testid="smart-add-confirm"
              >
                {step === "confirming" ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  setStep("input");
                  setError(null);
                }}
                disabled={step === "confirming"}
              >
                Back
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={props.onClose}
                disabled={step === "confirming"}
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
