import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Source } from "@graph-ai-tutor/shared";

vi.mock("../api/client", () => {
  return {
    getConceptSources: vi.fn(async () => ({ sources: [] })),
    postConceptLocalSource: vi.fn(async () => {
      throw new Error("postConceptLocalSource not mocked");
    }),
    postConceptNote: vi.fn(async () => {
      throw new Error("postConceptNote not mocked");
    })
  };
});

vi.mock("../SourcePanel", () => {
  return {
    SourcePanel: (props: { sourceId: string | null }) => (
      <div data-testid="source-panel-proxy">{props.sourceId ?? "none"}</div>
    )
  };
});

import { getConceptSources, postConceptLocalSource, postConceptNote } from "../api/client";
import { ConceptNotesV2 } from "./ConceptNotesV2";

function source(id: string, url: string, title: string, createdAt = 1): Source {
  return { id, url, title, createdAt };
}

describe("ConceptNotesV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only local vault notes and selects noteSourceId when available", async () => {
    vi.mocked(getConceptSources).mockResolvedValueOnce({
      sources: [
        source("remote_1", "https://example.com", "Web source", 1),
        source("local_1", "vault://sources/source_1.md", "Local note 1", 2),
        source("note_1", "vault://notes/note_concept_a.md", "Primary note", 3)
      ]
    });

    render(
      <ConceptNotesV2
        conceptId="concept_a"
        conceptTitle="KV cache"
        noteSourceId="note_1"
      />
    );

    expect(await screen.findByText("Primary note")).toBeVisible();
    expect(screen.getByText("Local note 1")).toBeVisible();
    expect(screen.queryByText("Web source")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("source-panel-proxy")).toHaveTextContent("note_1");
    });
  });

  it("auto-creates a primary note when token is triggered and no primary note exists", async () => {
    const created = source("note_new", "vault://notes/note_concept_b.md", "KV cache notes", 10);

    vi.mocked(getConceptSources)
      .mockResolvedValueOnce({ sources: [] })
      .mockResolvedValueOnce({ sources: [created] });

    vi.mocked(postConceptNote).mockResolvedValueOnce({ source: created });

    const onPrimaryNoteCreated = vi.fn();

    render(
      <ConceptNotesV2
        conceptId="concept_b"
        conceptTitle="KV cache"
        noteSourceId={null}
        autoCreateToken={1}
        onPrimaryNoteCreated={onPrimaryNoteCreated}
      />
    );

    await waitFor(() => expect(postConceptNote).toHaveBeenCalledTimes(1));
    expect(onPrimaryNoteCreated).toHaveBeenCalledWith("note_new");
    expect(screen.getByTestId("source-panel-proxy")).toHaveTextContent("note_new");
  });

  it("creates additional local notes from the New note button", async () => {
    const first = source("note_primary", "vault://notes/note_concept_c.md", "Primary", 5);
    const second = source("source_new", "vault://sources/source_new.md", "Extra", 6);

    vi.mocked(getConceptSources)
      .mockResolvedValueOnce({ sources: [first] })
      .mockResolvedValueOnce({ sources: [first, second] });
    vi.mocked(postConceptLocalSource).mockResolvedValueOnce({ source: second });

    render(
      <ConceptNotesV2
        conceptId="concept_c"
        conceptTitle="KV cache"
        noteSourceId="note_primary"
      />
    );

    expect(await screen.findByText("Primary")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /new note/i }));

    await waitFor(() => expect(postConceptLocalSource).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("source-panel-proxy")).toHaveTextContent("source_new");
  });
});
