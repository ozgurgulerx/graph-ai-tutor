import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConceptSummary } from "@graph-ai-tutor/shared";

import { CommandPalette } from "./CommandPalette";

const makeConcept = (id: string, title: string, kind = "Concept", module: string | null = null): ConceptSummary => ({
  id,
  title,
  kind: kind as ConceptSummary["kind"],
  module,
  masteryScore: 0
});

const sampleConcepts: ConceptSummary[] = [
  makeConcept("c1", "Binary Search", "Method", "Algorithms"),
  makeConcept("c2", "Binary Tree", "Concept", "Trees"),
  makeConcept("c3", "Hash Map", "Pattern", "Hashing"),
  makeConcept("c4", "Graph Traversal", "Method", "Graphs")
];

describe("CommandPalette", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={() => {}} actions={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when open", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "test", label: "Test Action", onSelect: () => {} }]}
      />
    );
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();
  });

  it("shows actions in the list", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[
          { id: "a1", label: "Start training session", onSelect: () => {} },
          { id: "a2", label: "Open settings", onSelect: () => {} }
        ]}
      />
    );
    expect(screen.getByText("Start training session")).toBeInTheDocument();
    expect(screen.getByText("Open settings")).toBeInTheDocument();
  });

  it("filters actions by query", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[
          { id: "a1", label: "Start training session", onSelect: () => {} },
          { id: "a2", label: "Open settings", onSelect: () => {} }
        ]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "training" } });

    expect(screen.getByText("Start training session")).toBeInTheDocument();
    expect(screen.queryByText("Open settings")).not.toBeInTheDocument();
  });

  it("calls onSelect and onClose when an action is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        actions={[{ id: "a1", label: "Start training", onSelect }]}
      />
    );

    fireEvent.click(screen.getByText("Start training"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        actions={[{ id: "a1", label: "Test", onSelect: () => {} }]}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows empty message when no actions match", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "a1", label: "Start training", onSelect: () => {} }]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  // --- Concept search tests ---

  it("renders concepts when query >= 2 chars matches", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[]}
        concepts={sampleConcepts}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "bin" } });

    expect(screen.getByText("Binary Search")).toBeInTheDocument();
    expect(screen.getByText("Binary Tree")).toBeInTheDocument();
    expect(screen.queryByText("Hash Map")).not.toBeInTheDocument();
  });

  it("does not show concepts when query < 2 chars", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[]}
        concepts={sampleConcepts}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "b" } });

    expect(screen.queryByText("Binary Search")).not.toBeInTheDocument();
    expect(screen.queryByText("Binary Tree")).not.toBeInTheDocument();
  });

  it("calls onSelectConcept on concept click", () => {
    const onSelectConcept = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        actions={[]}
        concepts={sampleConcepts}
        onSelectConcept={onSelectConcept}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "hash" } });

    fireEvent.click(screen.getByText("Hash Map"));
    expect(onSelectConcept).toHaveBeenCalledWith("c3");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'Concepts' group header when both concepts and actions match", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "a1", label: "Start training session", onSelect: () => {} }]}
        concepts={[makeConcept("c1", "Training Data", "Concept", "ML")]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "training" } });

    expect(screen.getByText("Concepts")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Training Data")).toBeInTheDocument();
    expect(screen.getByText("Start training session")).toBeInTheDocument();
  });

  it("shows 'No results' when query >= 2 chars but nothing matches", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "a1", label: "Start training", onSelect: () => {} }]}
        concepts={sampleConcepts}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "xyzabc" } });

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("shows concept detail text (kind and module)", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[]}
        concepts={[makeConcept("c1", "Binary Search", "Method", "Algorithms")]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "binary" } });

    expect(screen.getByText("Method · Algorithms")).toBeInTheDocument();
  });

  it("caps concept results at 8", () => {
    const manyConcepts = Array.from({ length: 15 }, (_, i) =>
      makeConcept(`c${i}`, `Concept ${i}`, "Concept")
    );

    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[]}
        concepts={manyConcepts}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "concept" } });

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(8);
  });
});
