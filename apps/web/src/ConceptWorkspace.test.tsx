import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Concept } from "@graph-ai-tutor/shared";

vi.mock("./api/client", () => {
  return {
    getConceptDraftRevisions: vi.fn(async () => ({ revisions: [] })),
    getConceptSources: vi.fn(async () => ({ sources: [] })),
    attachConceptSource: vi.fn(async () => {
      throw new Error("attachConceptSource should not be called in this test");
    }),
    postConceptDistill: vi.fn(async () => {
      throw new Error("postConceptDistill should not be called in this test");
    }),
    postDraftRevisionApply: vi.fn(async () => {
      throw new Error("postDraftRevisionApply should not be called in this test");
    }),
    postDraftRevisionReject: vi.fn(async () => {
      throw new Error("postDraftRevisionReject should not be called in this test");
    }),
    postDraftRevisionRevert: vi.fn(async () => {
      throw new Error("postDraftRevisionRevert should not be called in this test");
    }),
    getConceptMerges: vi.fn(async () => ({ merges: [] })),
    postConceptMergePreview: vi.fn(async () => {
      throw new Error("postConceptMergePreview should not be called in this test");
    }),
    postConceptMergeApply: vi.fn(async () => {
      throw new Error("postConceptMergeApply should not be called in this test");
    }),
    postConceptMergeUndo: vi.fn(async () => {
      throw new Error("postConceptMergeUndo should not be called in this test");
    }),
    getConceptQuizzes: vi.fn(async () => ({ quizzes: [] })),
    postGenerateConceptQuizzes: vi.fn(async () => ({ quizzes: [] })),
    postConceptLocalSource: vi.fn(async () => {
      throw new Error("postConceptLocalSource should not be called in this test");
    }),
    postContextPack: vi.fn(async () => ({
      markdown: "",
      fileName: "test.md",
      conceptIds: []
    })),
    getConceptNote: vi.fn(async () => ({ source: null, content: "" })),
    postConceptNote: vi.fn(async () => {
      throw new Error("postConceptNote should not be called in this test");
    }),
    getConceptBacklinks: vi.fn(async () => ({ concepts: [] })),
    getSourceContent: vi.fn(async () => ({ source: null, content: "" })),
    postSourceContent: vi.fn(async () => {
      throw new Error("postSourceContent should not be called in this test");
    }),
    getUniversalSearch: vi.fn(async () => ({ concepts: [], sources: [], evidence: [] }))
  };
});

import { ConceptWorkspace } from "./ConceptWorkspace";

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: "concept_test",
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

describe("ConceptWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes L1 bullets (trims lines and drops empty lines)", async () => {
    const concept = makeConcept({ l0: "Old", l1: [] });
    const onSave = vi.fn(
      async (input: { id: string; l0: string | null; l1: string[]; l2: string[] }) => {
        return makeConcept({
          id: input.id,
          l0: input.l0,
          l1: input.l1,
          l2: input.l2,
          updatedAt: 1
        });
      }
    );

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={onSave}
        onConceptUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    fireEvent.change(screen.getByLabelText(/edit l1 bullets/i), {
      target: { value: "  New bullet  \n\n Second \n   \n" }
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      id: "concept_test",
      l0: "Old",
      l1: ["New bullet", "Second"],
      l2: []
    });
  });

  it("normalizes L0 empty string to null", async () => {
    const concept = makeConcept({ l0: "Has value", l1: [] });
    const onSave = vi.fn(
      async (input: { id: string; l0: string | null; l1: string[]; l2: string[] }) => {
        return makeConcept({
          id: input.id,
          l0: input.l0,
          l1: input.l1,
          l2: input.l2,
          updatedAt: 1
        });
      }
    );

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={onSave}
        onConceptUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    fireEvent.change(screen.getByLabelText(/edit l0/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      id: "concept_test",
      l0: null,
      l1: [],
      l2: []
    });
  });

  it("normalizes L2 steps (trims lines and drops empty lines)", async () => {
    const concept = makeConcept({ l0: "Old", l1: [], l2: [] });
    const onSave = vi.fn(
      async (input: { id: string; l0: string | null; l1: string[]; l2: string[] }) => {
        return makeConcept({
          id: input.id,
          l0: input.l0,
          l1: input.l1,
          l2: input.l2,
          updatedAt: 1
        });
      }
    );

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={onSave}
        onConceptUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    fireEvent.change(screen.getByLabelText(/edit l2 steps/i), {
      target: { value: "  First step  \n\n Second \n   \n" }
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      id: "concept_test",
      l0: "Old",
      l1: [],
      l2: ["First step", "Second"]
    });
  });

  it("shows a draft revision diff after distill and applies it", async () => {
    const concept = makeConcept({ title: "KV cache", l1: ["Old bullet"], l2: [] });

    const api = await import("./api/client");

    vi.mocked(api.getConceptDraftRevisions)
      .mockResolvedValueOnce({ revisions: [] })
      .mockResolvedValueOnce({
        revisions: [
          {
            id: "draft_revision_1",
            conceptId: concept.id,
            kind: "distill",
            status: "applied",
            before: { l1: ["Old bullet"], l2: [] },
            after: { l1: ["New bullet"], l2: ["New step"] },
            diff: "--- L1 (before)\n+++ L1 (after)\n- Old bullet\n+ New bullet\n",
            createdAt: 0,
            appliedAt: 1,
            rejectedAt: null
          }
        ]
      });

    vi.mocked(api.postConceptDistill).mockResolvedValueOnce({
      revision: {
        id: "draft_revision_1",
        conceptId: concept.id,
        kind: "distill",
        status: "draft",
        before: { l1: ["Old bullet"], l2: [] },
        after: { l1: ["New bullet"], l2: ["New step"] },
        diff: "--- L1 (before)\n+++ L1 (after)\n- Old bullet\n+ New bullet\n",
        createdAt: 0,
        appliedAt: null,
        rejectedAt: null
      }
    });

    vi.mocked(api.postDraftRevisionApply).mockResolvedValueOnce({
      concept: makeConcept({ l1: ["New bullet"], l2: ["New step"], updatedAt: 2 }),
      revision: {
        id: "draft_revision_1",
        conceptId: concept.id,
        kind: "distill",
        status: "applied",
        before: { l1: ["Old bullet"], l2: [] },
        after: { l1: ["New bullet"], l2: ["New step"] },
        diff: "--- L1 (before)\n+++ L1 (after)\n- Old bullet\n+ New bullet\n",
        createdAt: 0,
        appliedAt: 1,
        rejectedAt: null
      }
    });

    const onConceptUpdated = vi.fn();

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={vi.fn(async () => concept)}
        onConceptUpdated={onConceptUpdated}
      />
    );

    await waitFor(() => expect(api.getConceptDraftRevisions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId("distill-run"));
    expect(await screen.findByTestId("draft-revision-diff")).toHaveTextContent(/\+\+\+ L1/i);

    fireEvent.click(screen.getByTestId("draft-revision-apply"));
    await waitFor(() => expect(api.postDraftRevisionApply).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onConceptUpdated).toHaveBeenCalledTimes(1));
  });

  it("renders generated quizzes in the preview list", async () => {
    const concept = makeConcept({ title: "KV cache" });

    const api = await import("./api/client");
    vi.mocked(api.postGenerateConceptQuizzes).mockResolvedValueOnce({
      quizzes: [
        {
          id: "review_item_1",
          conceptId: concept.id,
          type: "CLOZE",
          prompt: "KV cache stores ___ during decoding.",
          answer: { blanks: ["keys and values"] },
          rubric: { explanation: "It stores the key/value tensors." },
          status: "draft",
          dueAt: null,
          ease: 2.5,
          interval: 0,
          reps: 0,
          createdAt: 0,
          updatedAt: 0
        }
      ]
    });

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={vi.fn(async () => concept)}
        onConceptUpdated={vi.fn()}
      />
    );

    // Switch to Quizzes tab first
    fireEvent.click(screen.getByTestId("tab-quizzes"));

    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));

    expect(await screen.findByTestId("quiz-list")).toBeVisible();
    expect(screen.getByTestId("quiz-review_item_1")).toBeVisible();
    expect(screen.getByText(/kv cache stores/i)).toBeVisible();
  });

  it("calls onShowContextPack when Generate context is clicked", async () => {
    const concept = makeConcept({ title: "KV cache" });

    const api = await import("./api/client");
    vi.mocked(api.postContextPack).mockResolvedValueOnce({
      markdown: "# Context Pack: KV cache\n",
      fileName: "KV_cache-1-hop-123.md",
      conceptIds: [concept.id]
    });

    const onShowContextPack = vi.fn();

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={vi.fn(async () => concept)}
        onConceptUpdated={vi.fn()}
        onShowContextPack={onShowContextPack}
      />
    );

    fireEvent.click(screen.getByTestId("context-pack-generate"));

    await waitFor(() => expect(api.postContextPack).toHaveBeenCalledTimes(1));
    expect(api.postContextPack).toHaveBeenCalledWith(concept.id, {
      radius: "1-hop",
      includeCode: false,
      includeQuiz: false
    });
    await waitFor(() => expect(onShowContextPack).toHaveBeenCalledTimes(1));
    expect(onShowContextPack).toHaveBeenCalledWith(
      "# Context Pack: KV cache\n",
      "KV_cache-1-hop-123.md"
    );
  });

  it("shows sub-tabs and switches between them", async () => {
    const concept = makeConcept({ title: "KV cache" });

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={vi.fn(async () => concept)}
        onConceptUpdated={vi.fn()}
      />
    );

    // Summary tab should be active by default
    expect(screen.getByTestId("concept-sub-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("tab-summary")).toHaveClass("tabActive");

    // L0 section should be visible in summary tab
    expect(screen.getByLabelText("Summaries")).toBeInTheDocument();

    // Switch to Note tab
    fireEvent.click(screen.getByTestId("tab-note"));
    expect(screen.getByTestId("tab-note")).toHaveClass("tabActive");
    expect(screen.getByTestId("note-empty-state")).toBeInTheDocument();

    // Switch to Sources tab
    fireEvent.click(screen.getByTestId("tab-sources"));
    expect(screen.getByTestId("tab-sources")).toHaveClass("tabActive");
    expect(screen.getByLabelText("Sources")).toBeInTheDocument();

    // Switch to Quizzes tab
    fireEvent.click(screen.getByTestId("tab-quizzes"));
    expect(screen.getByTestId("tab-quizzes")).toHaveClass("tabActive");
    expect(screen.getByLabelText("Quizzes")).toBeInTheDocument();

    // Switch back to Summary
    fireEvent.click(screen.getByTestId("tab-summary"));
    expect(screen.getByTestId("tab-summary")).toHaveClass("tabActive");
  });

  it("shows helper text explaining L0/L1/L2 levels", async () => {
    const concept = makeConcept({ title: "KV cache" });

    render(
      <ConceptWorkspace
        concept={concept}
        onSave={vi.fn(async () => concept)}
        onConceptUpdated={vi.fn()}
      />
    );

    expect(screen.getByTestId("summary-levels-help")).toHaveTextContent(
      /summary levels, not graph neighborhood depth/i
    );
    expect(screen.getByText(/one-line definition \(quick recall\)/i)).toBeInTheDocument();
    expect(screen.getByText(/key bullets \(what matters most\)/i)).toBeInTheDocument();
    expect(screen.getByText(/deeper mechanism\/steps \(how it works\)/i)).toBeInTheDocument();
  });
});
