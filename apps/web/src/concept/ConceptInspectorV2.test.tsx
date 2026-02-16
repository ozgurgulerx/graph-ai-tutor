import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Concept, GraphResponse } from "@graph-ai-tutor/shared";

vi.mock("../ConceptWorkspace", () => {
  return {
    ConceptWorkspace: (props: { mode?: string; autoGenerateQuizzesToken?: number }) => (
      <div
        data-testid={`concept-workspace-stub-${props.mode ?? "default"}`}
        data-auto-generate-token={String(props.autoGenerateQuizzesToken ?? 0)}
      />
    )
  };
});

vi.mock("./ConceptNotesV2", () => {
  return {
    ConceptNotesV2: (props: { autoCreateToken?: number }) => (
      <div
        data-testid="concept-notes-stub"
        data-auto-create-token={String(props.autoCreateToken ?? 0)}
      />
    )
  };
});

vi.mock("../api/client", () => {
  return {
    getUniversalSearch: vi.fn(async () => ({ concepts: [], sources: [], evidence: [] }))
  };
});

import { getUniversalSearch } from "../api/client";
import { ConceptInspectorV2 } from "./ConceptInspectorV2";

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: "concept_main",
    title: "KV cache",
    kind: "Concept",
    l0: null,
    l1: [],
    l2: [],
    module: null,
    noteSourceId: null,
    context: null,
    masteryScore: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

function makeGraph(): GraphResponse {
  return {
    nodes: [
      { id: "concept_main", title: "KV cache", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null },
      { id: "concept_prereq", title: "Attention", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null },
      { id: "concept_dependent", title: "PagedAttention", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null },
      { id: "concept_other", title: "Dense attention", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null },
      { id: "concept_target", title: "Routing", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null }
    ],
    edges: [
      {
        id: "edge_prereq",
        fromConceptId: "concept_prereq",
        toConceptId: "concept_main",
        type: "PREREQUISITE_OF"
      },
      {
        id: "edge_dependent",
        fromConceptId: "concept_main",
        toConceptId: "concept_dependent",
        type: "PREREQUISITE_OF"
      },
      {
        id: "edge_contrast",
        fromConceptId: "concept_main",
        toConceptId: "concept_other",
        type: "CONTRASTS_WITH"
      }
    ],
    capped: false
  };
}

describe("ConceptInspectorV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows prerequisite/dependent/other relationship rows", async () => {
    render(
      <ConceptInspectorV2
        concept={makeConcept()}
        graph={makeGraph()}
        onSave={vi.fn(async () => makeConcept())}
        onConceptUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^add relation$/i }));

    expect(await screen.findByTestId("relationship-row-edge_prereq")).toBeVisible();
    expect(screen.getByTestId("relationship-row-edge_dependent")).toBeVisible();
    expect(screen.getByTestId("relationship-row-edge_contrast")).toBeVisible();
  });

  it("forwards hover and click events for relationship rows", async () => {
    const onHoverRelationship = vi.fn();
    const onSelectRelationship = vi.fn();

    render(
      <ConceptInspectorV2
        concept={makeConcept()}
        graph={makeGraph()}
        onSave={vi.fn(async () => makeConcept())}
        onConceptUpdated={vi.fn()}
        onHoverRelationship={onHoverRelationship}
        onSelectRelationship={onSelectRelationship}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^add relation$/i }));

    const row = await screen.findByTestId("relationship-row-edge_contrast");
    fireEvent.mouseEnter(row);
    expect(onHoverRelationship).toHaveBeenLastCalledWith({
      edgeId: "edge_contrast",
      conceptId: "concept_other"
    });

    fireEvent.click(row);
    expect(onSelectRelationship).toHaveBeenCalledWith({
      edgeId: "edge_contrast",
      conceptId: "concept_other"
    });

    fireEvent.mouseLeave(row);
    expect(onHoverRelationship).toHaveBeenLastCalledWith(null);
  });

  it("submits add relation as a draft edge request", async () => {
    vi.mocked(getUniversalSearch).mockResolvedValueOnce({
      concepts: [
        {
          id: "concept_target",
          title: "Routing",
          kind: "Concept",
          module: null,
          masteryScore: 0,
          rank: 0,
          titleHighlight: null,
          snippetHighlight: null
        }
      ],
      sources: [],
      evidence: []
    });

    const onCreateDraftRelation = vi.fn(async () => {});

    render(
      <ConceptInspectorV2
        concept={makeConcept()}
        graph={makeGraph()}
        onSave={vi.fn(async () => makeConcept())}
        onConceptUpdated={vi.fn()}
        onCreateDraftRelation={onCreateDraftRelation}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^add relation$/i }));

    fireEvent.change(screen.getByTestId("relation-target-query"), {
      target: { value: "ro" }
    });

    await waitFor(() => expect(getUniversalSearch).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByTestId("relation-target-option-concept_target"));

    fireEvent.change(screen.getByTestId("relation-edge-type"), {
      target: { value: "CONTRASTS_WITH" }
    });
    fireEvent.click(screen.getByLabelText(/target -> selected/i));

    fireEvent.click(screen.getByTestId("relation-submit"));

    await waitFor(() =>
      expect(onCreateDraftRelation).toHaveBeenCalledWith({
        fromConceptId: "concept_target",
        toConceptId: "concept_main",
        type: "CONTRASTS_WITH",
        evidenceChunkIds: []
      })
    );
  });

  it("applies external action requests for note/quiz/relation flows", async () => {
    const baseProps = {
      concept: makeConcept(),
      graph: makeGraph(),
      onSave: vi.fn(async () => makeConcept()),
      onConceptUpdated: vi.fn()
    } as const;

    const { rerender } = render(<ConceptInspectorV2 {...baseProps} />);

    rerender(
      <ConceptInspectorV2
        {...baseProps}
        actionRequest={{ type: "new_note", token: 1 }}
      />
    );

    expect(await screen.findByTestId("concept-notes-stub")).toHaveAttribute(
      "data-auto-create-token",
      "1"
    );

    rerender(
      <ConceptInspectorV2
        {...baseProps}
        actionRequest={{ type: "generate_quiz", token: 2 }}
      />
    );

    expect(await screen.findByTestId("concept-workspace-stub-quizzes")).toHaveAttribute(
      "data-auto-generate-token",
      "1"
    );

    rerender(
      <ConceptInspectorV2
        {...baseProps}
        actionRequest={{ type: "add_relation", token: 3 }}
      />
    );

    expect(await screen.findByTestId("relationships-composer")).toBeVisible();
  });
});
