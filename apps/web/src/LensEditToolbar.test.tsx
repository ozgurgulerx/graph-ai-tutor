import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EdgeDraftState } from "./LensEditToolbar";
import { LensEditToolbar } from "./LensEditToolbar";

const noop = () => {};

function renderToolbar(overrides: Partial<{
  edgeDraftState: EdgeDraftState;
  error: string | null;
  saving: boolean;
  onAddConcept: () => void;
  onStartEdgeDraft: () => void;
  onCancelEdgeDraft: () => void;
}> = {}) {
  return render(
    <LensEditToolbar
      onAddConcept={overrides.onAddConcept ?? noop}
      edgeDraftState={overrides.edgeDraftState ?? { phase: "idle" }}
      onStartEdgeDraft={overrides.onStartEdgeDraft ?? noop}
      onCancelEdgeDraft={overrides.onCancelEdgeDraft ?? noop}
      error={overrides.error ?? null}
      saving={overrides.saving ?? false}
    />
  );
}

describe("LensEditToolbar", () => {
  it("renders Add concept and Add edge buttons in idle state", () => {
    renderToolbar();

    expect(screen.getByTestId("lens-add-concept")).toBeInTheDocument();
    expect(screen.getByTestId("lens-add-edge")).toBeInTheDocument();
  });

  it("shows status text in pickSource phase", () => {
    renderToolbar({ edgeDraftState: { phase: "pickSource" } });

    expect(screen.getByTestId("lens-edit-status")).toHaveTextContent("Click a source node...");
  });

  it("shows source title in pickTarget phase", () => {
    renderToolbar({
      edgeDraftState: { phase: "pickTarget", sourceId: "a", sourceTitle: "Node A" }
    });

    expect(screen.getByTestId("lens-edit-status")).toHaveTextContent("Click target node (source: Node A)");
  });

  it("shows both titles in pickType phase", () => {
    renderToolbar({
      edgeDraftState: {
        phase: "pickType",
        sourceId: "a",
        targetId: "b",
        sourceTitle: "Node A",
        targetTitle: "Node B"
      }
    });

    expect(screen.getByTestId("lens-edit-status")).toHaveTextContent("Node A");
    expect(screen.getByTestId("lens-edit-status")).toHaveTextContent("Node B");
  });

  it("shows Cancel button during draft, not Add edge", () => {
    renderToolbar({ edgeDraftState: { phase: "pickSource" } });

    expect(screen.getByTestId("lens-cancel-edge")).toBeInTheDocument();
    expect(screen.queryByTestId("lens-add-edge")).not.toBeInTheDocument();
  });

  it("calls onCancelEdgeDraft when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderToolbar({
      edgeDraftState: { phase: "pickSource" },
      onCancelEdgeDraft: onCancel
    });

    fireEvent.click(screen.getByTestId("lens-cancel-edge"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("displays error message when error is set", () => {
    renderToolbar({ error: "Cannot create: would form a prerequisite cycle" });

    expect(screen.getByTestId("lens-edit-error")).toHaveTextContent(
      "Cannot create: would form a prerequisite cycle"
    );
  });

  it("disables buttons when saving", () => {
    renderToolbar({ saving: true });

    expect(screen.getByTestId("lens-add-concept")).toBeDisabled();
    expect(screen.getByTestId("lens-add-edge")).toBeDisabled();
  });

  it("disables Add concept during drafting", () => {
    renderToolbar({ edgeDraftState: { phase: "pickSource" } });

    expect(screen.getByTestId("lens-add-concept")).toBeDisabled();
  });

  it("calls onAddConcept when Add concept is clicked", () => {
    const onAdd = vi.fn();
    renderToolbar({ onAddConcept: onAdd });

    fireEvent.click(screen.getByTestId("lens-add-concept"));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onStartEdgeDraft when Add edge is clicked", () => {
    const onStart = vi.fn();
    renderToolbar({ onStartEdgeDraft: onStart });

    fireEvent.click(screen.getByTestId("lens-add-edge"));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
