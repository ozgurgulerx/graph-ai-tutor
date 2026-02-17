import { useState } from "react";

import { postConcept } from "./api/client";

type SmartAddModalProps = {
  onCreated: (conceptId: string) => void;
  onClose: () => void;
};

export function SmartAddModal(props: SmartAddModalProps) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const { concept } = await postConcept({ title: trimmed });
      props.onCreated(concept.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add concept");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" data-testid="smart-add-modal" onClick={props.onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <h3 className="paneTitle">Add concept</h3>

        <label className="mutedText" htmlFor="smart-add-title">
          Concept title
        </label>
        <input
          id="smart-add-title"
          className="textInput"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Retrieval-augmented generation"
          disabled={loading}
          maxLength={160}
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
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            data-testid="smart-add-submit"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button type="button" className="secondaryButton" onClick={props.onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
