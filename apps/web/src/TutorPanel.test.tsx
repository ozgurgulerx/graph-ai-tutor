import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TutorPanel } from "./TutorPanel";

describe("TutorPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks tutor, renders answer + citations, and highlights used nodes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/tutor")) {
        return new Response(
          JSON.stringify({
            result: {
              answer_markdown: "Answer.",
              cited_chunk_ids: ["chunk_1"],
              used_concept_ids: ["concept_a"],
              used_edge_ids: []
            },
            citations: [
              {
                id: "chunk_1",
                sourceId: "source_1",
                content: "Evidence.",
                sourceUrl: "seed://test/source",
                sourceTitle: "Seed"
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onHighlightConceptIds = vi.fn();

    render(
      <TutorPanel
        graph={{
          nodes: [
            { id: "concept_a", title: "A", kind: "Concept", module: null, masteryScore: 0, pagerank: 0, community: null }
          ],
          edges: [],
          capped: false
        }}
        onHighlightConceptIds={onHighlightConceptIds}
      />
    );

    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: "What is A?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask/i }));

    expect(await screen.findByText(/answer\./i)).toBeVisible();
    expect(await screen.findByText(/chunk_1/i)).toBeVisible();
    expect(await screen.findByText(/evidence\./i)).toBeVisible();

    expect(onHighlightConceptIds).toHaveBeenCalledWith(["concept_a"]);

  });

  it("includes selection context in the tutor request payload when provided", async () => {
    let postedQuestion = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith("/api/tutor")) {
        const raw = typeof init?.body === "string" ? init.body : "{}";
        const body = JSON.parse(raw) as { question?: string };
        postedQuestion = body.question ?? "";
        return new Response(
          JSON.stringify({
            result: {
              answer_markdown: "Answer.",
              cited_chunk_ids: ["chunk_1"],
              used_concept_ids: [],
              used_edge_ids: []
            },
            citations: [
              {
                id: "chunk_1",
                sourceId: "source_1",
                content: "Evidence.",
                sourceUrl: "seed://test/source",
                sourceTitle: "Seed"
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TutorPanel
        graph={{ nodes: [], edges: [], capped: false }}
        selectionContext={{
          conceptId: "concept_a",
          edgeId: "edge_a",
          lensNodeIds: ["concept_a", "concept_b"],
          lensEdgeIds: ["edge_a"],
          evidenceChunkIds: ["chunk_1"]
        }}
        onHighlightConceptIds={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: "What matters?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask/i }));
    await screen.findByText(/answer\./i);

    expect(postedQuestion).toContain("[selection_context]");
    expect(postedQuestion).toContain("\"conceptId\":\"concept_a\"");
    expect(postedQuestion).toContain("\"edgeId\":\"edge_a\"");
    expect(postedQuestion).toContain("What matters?");
  });

  it("seeds the question input when a seed token is provided", async () => {
    const { rerender } = render(
      <TutorPanel
        graph={{ nodes: [], edges: [], capped: false }}
        onHighlightConceptIds={() => {}}
        seedQuestion="first"
        seedQuestionToken={1}
      />
    );

    expect(screen.getByLabelText(/question/i)).toHaveValue("first");

    rerender(
      <TutorPanel
        graph={{ nodes: [], edges: [], capped: false }}
        onHighlightConceptIds={() => {}}
        seedQuestion="second"
        seedQuestionToken={2}
      />
    );

    expect(screen.getByLabelText(/question/i)).toHaveValue("second");
  });
});
