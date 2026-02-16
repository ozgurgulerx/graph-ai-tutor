import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConceptSummary, EdgeSummary } from "@graph-ai-tutor/shared";

import { ConceptTree } from "./ConceptTree";

function node(id: string, title: string, module: string | null = null): ConceptSummary {
  return { id, title, kind: "Concept", module, masteryScore: 0, pagerank: 0, community: null };
}

function edge(from: string, to: string, type: EdgeSummary["type"]): EdgeSummary {
  return { id: `${from}-${to}`, fromConceptId: from, toConceptId: to, type };
}

const nodes: ConceptSummary[] = [
  node("ml", "Machine Learning"),
  node("dl", "Deep Learning"),
  node("cnn", "CNN"),
  node("orphan", "Stray Concept", "misc"),
];

const edges: EdgeSummary[] = [
  edge("dl", "ml", "IS_A"),
  edge("cnn", "dl", "IS_A"),
];

describe("ConceptTree", () => {
  it("renders tree with hierarchy", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole("tree")).toBeInTheDocument();
    // Root should be visible
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    // Children should not be visible (collapsed by default)
    expect(screen.queryByText("Deep Learning")).not.toBeInTheDocument();
  });

  it("expands and collapses on disclosure click", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    // Click expand on root
    const expandBtn = screen.getAllByLabelText("Expand")[0];
    fireEvent.click(expandBtn);

    expect(screen.getByText("Deep Learning")).toBeInTheDocument();

    // Click collapse
    const collapseBtn = screen.getAllByLabelText("Collapse")[0];
    fireEvent.click(collapseBtn);

    expect(screen.queryByText("Deep Learning")).not.toBeInTheDocument();
  });

  it("calls onSelect when a concept is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText("Machine Learning"));
    expect(onSelect).toHaveBeenCalledWith("ml");
  });

  it("marks selected concept with aria-current", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId="ml"
        onSelect={() => {}}
      />
    );

    const btn = screen.getByText("Machine Learning").closest("button.nodeButton");
    expect(btn).toHaveAttribute("aria-current", "true");
  });

  it("auto-expands ancestors when searching", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query="CNN"
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    // CNN is nested under DL → ML, all should be auto-expanded
    expect(screen.getByText("CNN")).toBeInTheDocument();
    expect(screen.getByText("Deep Learning")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
  });

  it("prunes non-matching branches when searching", () => {
    const extraNodes = [...nodes, node("rnn", "RNN")];
    const extraEdges = [...edges, edge("rnn", "dl", "IS_A")];

    render(
      <ConceptTree
        nodes={extraNodes}
        edges={extraEdges}
        query="CNN"
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText("CNN")).toBeInTheDocument();
    expect(screen.queryByText("RNN")).not.toBeInTheDocument();
  });

  it("renders orphan groups", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    // Orphan group header should be visible
    expect(screen.getByText("misc (1)")).toBeInTheDocument();
  });

  it("shows orphan nodes collapsed by default", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    // Orphan groups are collapsed by default
    expect(screen.getByText("misc (1)")).toBeInTheDocument();
    expect(screen.queryByText("Stray Concept")).not.toBeInTheDocument();
  });

  it("expands orphan group on disclosure click", () => {
    render(
      <ConceptTree
        nodes={nodes}
        edges={edges}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    // Click expand on orphan group
    const expandBtn = screen.getByText("misc (1)").closest(".treeRow")!.querySelector(".treeDisclosure")!;
    fireEvent.click(expandBtn);

    expect(screen.getByText("Stray Concept")).toBeInTheDocument();
  });

  it("returns null when no nodes", () => {
    const { container } = render(
      <ConceptTree
        nodes={[]}
        edges={[]}
        query=""
        selectedConceptId={null}
        onSelect={() => {}}
      />
    );

    expect(container.querySelector("[role=tree]")).toBeNull();
  });
});
