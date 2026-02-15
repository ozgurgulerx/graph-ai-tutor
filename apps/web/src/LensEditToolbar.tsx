export type EdgeDraftState =
  | { phase: "idle" }
  | { phase: "pickSource" }
  | { phase: "pickTarget"; sourceId: string; sourceTitle: string }
  | { phase: "pickType"; sourceId: string; targetId: string; sourceTitle: string; targetTitle: string };

type LensEditToolbarProps = {
  onAddConcept: () => void;
  edgeDraftState: EdgeDraftState;
  onStartEdgeDraft: () => void;
  onCancelEdgeDraft: () => void;
  error: string | null;
  saving: boolean;
};

export function LensEditToolbar({
  onAddConcept,
  edgeDraftState,
  onStartEdgeDraft,
  onCancelEdgeDraft,
  error,
  saving
}: LensEditToolbarProps) {
  const drafting = edgeDraftState.phase !== "idle";

  function statusText(): string | null {
    switch (edgeDraftState.phase) {
      case "pickSource":
        return "Click a source node...";
      case "pickTarget":
        return `Click target node (source: ${edgeDraftState.sourceTitle})`;
      case "pickType":
        return `Select edge type: ${edgeDraftState.sourceTitle} \u2192 ${edgeDraftState.targetTitle}`;
      default:
        return null;
    }
  }

  const status = statusText();

  return (
    <div className="lensEditToolbar" data-testid="lens-edit-toolbar">
      <button
        type="button"
        className="secondaryButton"
        onClick={onAddConcept}
        disabled={saving || drafting}
        data-testid="lens-add-concept"
      >
        Add concept
      </button>

      {drafting ? (
        <button
          type="button"
          className="ghostButton"
          onClick={onCancelEdgeDraft}
          data-testid="lens-cancel-edge"
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          className="secondaryButton"
          onClick={onStartEdgeDraft}
          disabled={saving}
          data-testid="lens-add-edge"
        >
          Add edge
        </button>
      )}

      {status ? (
        <span className="lensEditToolbar__status" data-testid="lens-edit-status">
          {status}
        </span>
      ) : null}

      {error ? (
        <span className="lensEditToolbar__error" role="alert" data-testid="lens-edit-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
