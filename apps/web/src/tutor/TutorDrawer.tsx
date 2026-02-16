import type { GraphResponse } from "@graph-ai-tutor/shared";

import { TutorPanel } from "../TutorPanel";

type TutorDrawerProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  graph: GraphResponse | null;
  onHighlightConceptIds: (ids: string[]) => void;
  selectedConceptId: string | null;
  selectedEdgeId: string | null;
  currentGraphContext?: {
    lensNodeIds?: string[];
    lensEdgeIds?: string[];
    evidenceChunkIds?: string[];
  };
  seedQuestion?: string;
  seedQuestionToken?: number;
};

export function TutorDrawer(props: TutorDrawerProps) {
  const selectionSummary = props.selectedEdgeId
    ? `Edge: ${props.selectedEdgeId}`
    : props.selectedConceptId
      ? `Concept: ${props.selectedConceptId}`
      : "No selection";

  return (
    <div
      className={`tutorDrawer ${props.open ? "tutorDrawerOpen" : "tutorDrawerClosed"}`}
      data-testid="tutor-drawer"
    >
      <button
        type="button"
        className="tutorDrawerToggle"
        onClick={() => props.setOpen(!props.open)}
        data-testid="tutor-drawer-toggle"
      >
        <span className="tutorDrawerToggleTitle">Tutor</span>
        <span className="tutorDrawerToggleHint">Cmd/Ctrl+K</span>
      </button>

      {props.open ? (
        <div className="tutorDrawerPanel" data-testid="tutor-drawer-panel">
          <div className="tutorDrawerHeader">
            <div className="mutedText">{selectionSummary}</div>
            <button
              type="button"
              className="ghostButton"
              onClick={() => props.setOpen(false)}
            >
              Close
            </button>
          </div>
          <TutorPanel
            graph={props.graph}
            onHighlightConceptIds={props.onHighlightConceptIds}
            selectionContext={{
              conceptId: props.selectedConceptId,
              edgeId: props.selectedEdgeId,
              lensNodeIds: props.currentGraphContext?.lensNodeIds ?? [],
              lensEdgeIds: props.currentGraphContext?.lensEdgeIds ?? [],
              evidenceChunkIds: props.currentGraphContext?.evidenceChunkIds ?? []
            }}
            seedQuestion={props.seedQuestion}
            seedQuestionToken={props.seedQuestionToken}
          />
        </div>
      ) : null}
    </div>
  );
}
