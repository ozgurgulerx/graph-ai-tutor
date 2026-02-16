import type cytoscape from "cytoscape";
import { useEffect } from "react";

export type InteractionMode = "pointer" | "pan";

type GraphNavToolbarProps = {
  cy: cytoscape.Core | null;
  interactionMode: InteractionMode;
  onInteractionModeChange: (mode: InteractionMode) => void;
};

export function GraphNavToolbar({
  cy,
  interactionMode,
  onInteractionModeChange
}: GraphNavToolbarProps) {
  function zoomBy(factor: number) {
    if (!cy) return;
    const el = cy.container();
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    cy.zoom({
      level: cy.zoom() * factor,
      renderedPosition: { x: width / 2, y: height / 2 }
    });
  }

  function handleFit() {
    if (!cy) return;
    cy.fit(cy.elements(), 50);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key) {
        case "v":
        case "V":
          onInteractionModeChange("pointer");
          break;
        case "h":
        case "H":
          onInteractionModeChange("pan");
          break;
        case "+":
        case "=":
          zoomBy(1.2);
          break;
        case "-":
          zoomBy(0.8);
          break;
        case "0":
          handleFit();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const btnClass = "graphNavToolbar__btn";
  const activeClass = `${btnClass} graphNavToolbar__btn--active`;

  return (
    <div className="graphNavToolbar" data-testid="graph-nav-toolbar">
      <button
        type="button"
        className={interactionMode === "pointer" ? activeClass : btnClass}
        onClick={() => onInteractionModeChange("pointer")}
        title="Pointer mode (V)"
        data-testid="nav-pointer"
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
          <path d="M5 3l14 9-6 1-4 6z" />
        </svg>
      </button>

      <button
        type="button"
        className={interactionMode === "pan" ? activeClass : btnClass}
        onClick={() => onInteractionModeChange("pan")}
        title="Pan mode (H)"
        data-testid="nav-pan"
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
          <path d="M18 11V6a2 2 0 0 0-4 0v5" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 12 0v-2a2 2 0 0 0-4 0" />
        </svg>
      </button>

      <div className="graphNavToolbar__separator" />

      <button
        type="button"
        className={btnClass}
        onClick={() => zoomBy(1.2)}
        title="Zoom in (+)"
        data-testid="nav-zoom-in"
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      <button
        type="button"
        className={btnClass}
        onClick={() => zoomBy(0.8)}
        title="Zoom out (-)"
        data-testid="nav-zoom-out"
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      <button
        type="button"
        className={btnClass}
        onClick={handleFit}
        title="Fit to screen (0)"
        data-testid="nav-fit"
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  );
}
