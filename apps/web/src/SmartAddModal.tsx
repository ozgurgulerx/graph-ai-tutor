import { useState } from "react";

import { postCapture } from "./api/client";

type SmartAddModalProps = {
  onCaptured: (changesetId: string) => void;
  onClose: () => void;
};

export function SmartAddModal(props: SmartAddModalProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const { changesetId } = await postCapture({ text: trimmed });
      props.onCaptured(changesetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create smart add draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" data-testid="smart-add-modal" onClick={props.onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <h3 className="paneTitle">Smart add concept</h3>

        <label className="mutedText" htmlFor="smart-add-title">
          Describe what you learned
        </label>
        <textarea
          id="smart-add-title"
          className="textInput"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I learned that RAG combines retrieval with generation."
          disabled={loading}
          rows={4}
          maxLength={10000}
          data-testid="smart-add-title"
        />
        <p className="mutedText">
          This creates a smart draft in Inbox with inferred relationships for review.
        </p>

        {error ? (
          <p role="alert" className="errorText">
            {error}
          </p>
        ) : null}

        <div className="buttonRow">
          <button
            type="button"
            className="primaryButton"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            data-testid="smart-add-submit"
          >
            {loading ? "Analyzing..." : "Create smart draft"}
          </button>
          <button type="button" className="secondaryButton" onClick={props.onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
