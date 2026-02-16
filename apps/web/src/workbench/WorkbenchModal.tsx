import type { GraphResponse } from "@graph-ai-tutor/shared";

import { InboxPanel } from "../InboxPanel";
import { ReviewPanel } from "../ReviewPanel";

export function WorkbenchModal(props: {
  mode: "inbox" | "review" | null;
  graph: GraphResponse | null;
  onClose: () => void;
  onGraphUpdated: () => Promise<void>;
  onOpenConcept: (conceptId: string) => void;
  onHighlightChangesetConceptIds?: (ids: string[]) => void;
  onCountsMaybeChanged?: () => void;
}) {
  if (!props.mode) return null;

  const title = props.mode === "inbox" ? "Workbench: Inbox" : "Workbench: Review";

  return (
    <div
      className="workbenchOverlay"
      data-testid="workbench-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="workbenchPanel">
        <div className="workbenchHeader">
          <h3>{title}</h3>
          <button type="button" className="ghostButton" onClick={props.onClose}>
            Close
          </button>
        </div>

        <div className="workbenchBody">
          {props.mode === "inbox" ? (
            <InboxPanel
              graph={props.graph}
              onGraphUpdated={async () => {
                await props.onGraphUpdated();
                props.onCountsMaybeChanged?.();
              }}
              onHighlightChangesetConceptIds={props.onHighlightChangesetConceptIds}
              onChangesetsUpdated={() => props.onCountsMaybeChanged?.()}
            />
          ) : (
            <ReviewPanel
              graph={props.graph}
              onOpenConcept={props.onOpenConcept}
              onDueCountChange={() => props.onCountsMaybeChanged?.()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
