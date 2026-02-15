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
    postContextPack: vi.fn(async () => ({
      markdown: "",
      fileName: "test.md",
      conceptIds: []
    }))
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
});
