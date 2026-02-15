import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api/client", () => {
  return {
    getConceptNote: vi.fn(async () => ({ source: null, content: "" })),
    postConceptNote: vi.fn(async () => ({
      source: { id: "source_1", url: "vault://notes/note.md", title: "Note", createdAt: 0 }
    })),
    getConceptBacklinks: vi.fn(async () => ({ concepts: [] })),
    getSourceContent: vi.fn(async () => ({
      source: { id: "source_1", url: "vault://notes/note.md", title: "Note", createdAt: 0 },
      content: "# Test\n\nSee [[Attention]] for details."
    })),
    postSourceContent: vi.fn(async () => ({
      source: { id: "source_1", url: "vault://notes/note.md", title: "Note", createdAt: 0 },
      contentHash: "abc",
      chunkCount: 1
    })),
    getUniversalSearch: vi.fn(async () => ({
      concepts: [{ id: "c_attn", title: "Attention", kind: "Concept", module: null, masteryScore: 0, rank: 0, titleHighlight: null, snippetHighlight: null }],
      sources: [],
      evidence: []
    }))
  };
});

import { ConceptNoteSection } from "./ConceptNoteSection";

describe("ConceptNoteSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when noteSourceId is null", () => {
    render(
      <ConceptNoteSection
        conceptId="c1"
        conceptTitle="Test"
        noteSourceId={null}
      />
    );

    expect(screen.getByTestId("note-empty-state")).toBeInTheDocument();
    expect(screen.getByText(/no note yet/i)).toBeInTheDocument();
    expect(screen.getByTestId("note-create")).toBeInTheDocument();
  });

  it("calls postConceptNote and onNoteCreated when Create button is clicked", async () => {
    const api = await import("./api/client");
    const onNoteCreated = vi.fn();

    render(
      <ConceptNoteSection
        conceptId="c1"
        conceptTitle="Test"
        noteSourceId={null}
        onNoteCreated={onNoteCreated}
      />
    );

    fireEvent.click(screen.getByTestId("note-create"));

    await waitFor(() => expect(api.postConceptNote).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onNoteCreated).toHaveBeenCalledWith("source_1"));
  });

  it("loads and renders note content with wiki-links in read mode", async () => {
    render(
      <ConceptNoteSection
        conceptId="c1"
        conceptTitle="Test"
        noteSourceId="source_1"
      />
    );

    expect(await screen.findByTestId("note-read-view")).toBeInTheDocument();

    // Wiki-link should be rendered as a button
    const wikiLink = await screen.findByText("Attention");
    expect(wikiLink).toBeInTheDocument();
    expect(wikiLink.tagName.toLowerCase()).toBe("button");
    expect(wikiLink).toHaveClass("wikiLink");
  });

  it("calls onOpenConcept when wiki-link is clicked", async () => {
    const api = await import("./api/client");
    const onOpenConcept = vi.fn();

    render(
      <ConceptNoteSection
        conceptId="c1"
        conceptTitle="Test"
        noteSourceId="source_1"
        onOpenConcept={onOpenConcept}
      />
    );

    const wikiLink = await screen.findByText("Attention");
    fireEvent.click(wikiLink);

    await waitFor(() => expect(api.getUniversalSearch).toHaveBeenCalledWith("Attention", 1));
    await waitFor(() => expect(onOpenConcept).toHaveBeenCalledWith("c_attn"));
  });

  it("renders backlinks when present", async () => {
    const api = await import("./api/client");
    vi.mocked(api.getConceptBacklinks).mockResolvedValueOnce({
      concepts: [
        { id: "c2", title: "Transformer", kind: "Concept", module: null, masteryScore: 0 }
      ]
    });

    render(
      <ConceptNoteSection
        conceptId="c1"
        conceptTitle="Attention"
        noteSourceId="source_1"
      />
    );

    expect(await screen.findByTestId("note-backlinks")).toBeInTheDocument();
    expect(screen.getByText("Transformer")).toBeInTheDocument();
    expect(screen.getByText(/mentioned by 1 note/i)).toBeInTheDocument();
  });
});
