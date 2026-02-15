import { useState } from "react";

import { postCapture } from "./api/client";

export function CaptureModal(props: {
  onCaptured: (changesetId: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await postCapture({ text: trimmed });
      props.onCaptured(res.changesetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" data-testid="capture-modal" onClick={props.onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <h3 className="paneTitle">Capture learning</h3>

        <label className="mutedText" htmlFor="capture-text">
          What did you learn?
        </label>
        <textarea
          id="capture-text"
          className="textInput"
          rows={6}
          placeholder="I learned that transformers use self-attention to mix token representations..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={10000}
          disabled={loading}
          data-testid="capture-textarea"
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
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            data-testid="capture-submit"
          >
            {loading ? "Capturing..." : "Capture"}
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={props.onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
