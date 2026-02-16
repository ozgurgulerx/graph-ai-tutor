import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getConceptMerges,
  getEdgeEvidence,
  postChangesetItemStatus,
  postConcept,
  postDraftEdge,
  postConceptMergeApply,
  postConceptMergePreview,
  postConceptMergeUndo,
  postTutor
} from "./client";

describe("web api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST /api/concept sends JSON body", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(
        JSON.stringify({
          concept: {
            id: "concept_1",
            title: "KV cache",
            l0: "Saved",
            l1: ["A"],
            l2: [],
            module: null,
            createdAt: 0,
            updatedAt: 1
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await postConcept({ id: "concept_1", l0: "Saved", l1: ["A"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock.mock.calls[0] ??
      []) as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("/api/concept");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    const body = init?.body;
    expect(typeof body).toBe("string");
    expect(JSON.parse(String(body))).toEqual({
      id: "concept_1",
      l0: "Saved",
      l1: ["A"]
    });
  });

  it("throws on non-2xx responses", async () => {
    await expect(postConcept({ id: "concept_1", l0: "x" })).rejects.toThrow(/http/i);
  });

  it("GET /api/edge/:id/evidence fetches evidence payload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      return new Response(
        JSON.stringify({
          edge: {
            id: "edge_1",
            fromConceptId: "concept_a",
            toConceptId: "concept_b",
            type: "USED_IN",
            sourceUrl: null,
            confidence: null,
            verifierScore: null,
            evidenceChunkIds: ["chunk_1"],
            createdAt: 0
          },
          evidence: [
            {
              chunk: {
                id: "chunk_1",
                sourceId: "source_1",
                content: "Chunk text",
                startOffset: 0,
                endOffset: 9,
                createdAt: 0
              },
              source: {
                id: "source_1",
                url: "https://example.com/src",
                title: "Src",
                createdAt: 0
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await getEdgeEvidence("edge_1");
    expect(res.edge.id).toBe("edge_1");
    expect(res.evidence[0]?.chunk.content).toBe("Chunk text");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = (fetchMock.mock.calls[0] ?? []) as unknown as [
      RequestInfo | URL,
      RequestInit | undefined
    ];
    expect(url).toBe("/api/edge/edge_1/evidence");
  });

  it("POST /api/changeset-item/:id/status sends status JSON body", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(
        JSON.stringify({
          item: {
            id: "changeset_item_1",
            changesetId: "changeset_1",
            entityType: "concept",
            action: "create",
            status: "accepted",
            payload: { id: "concept_new", title: "New" },
            createdAt: 0
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await postChangesetItemStatus("changeset_item_1", { status: "accepted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock.mock.calls[0] ??
      []) as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("/api/changeset-item/changeset_item_1/status");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    const body = init?.body;
    expect(typeof body).toBe("string");
    expect(JSON.parse(String(body))).toEqual({ status: "accepted" });
  });

  it("POST /api/changeset/edge-draft sends draft edge JSON body", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(
        JSON.stringify({
          changeset: {
            id: "changeset_1",
            sourceId: null,
            status: "draft",
            createdAt: 0,
            appliedAt: null
          },
          item: {
            id: "changeset_item_1",
            changesetId: "changeset_1",
            entityType: "edge",
            action: "create",
            status: "pending",
            payload: {
              fromConceptId: "concept_a",
              toConceptId: "concept_b",
              type: "DEPENDS_ON",
              evidenceChunkIds: []
            },
            createdAt: 0
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await postDraftEdge({
      fromConceptId: "concept_a",
      toConceptId: "concept_b",
      type: "DEPENDS_ON",
      evidenceChunkIds: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock.mock.calls[0] ??
      []) as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("/api/changeset/edge-draft");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      fromConceptId: "concept_a",
      toConceptId: "concept_b",
      type: "DEPENDS_ON",
      evidenceChunkIds: []
    });
  });

  it("POST /api/tutor sends question JSON body and parses citations", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
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
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await postTutor({ question: "What is KV cache?" });
    expect(res.result.cited_chunk_ids).toEqual(["chunk_1"]);
    expect(res.citations[0]?.id).toBe("chunk_1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock.mock.calls[0] ??
      []) as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("/api/tutor");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ question: "What is KV cache?" });
  });

  it("concept merge endpoints are wired", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = typeof input === "string" ? input : String(input);
      if (url.endsWith("/concept/merge/preview")) {
        return new Response(
          JSON.stringify({
            canonical: { id: "concept_a", title: "A", module: null },
            duplicates: [{ id: "concept_b", title: "B", module: null }],
            edgeChanges: [],
            counts: { edgesToRewire: 1, edgesToDelete: 0, reviewItemsToUpdate: 0, sourcesToMove: 0 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/concept/merge/apply")) {
        return new Response(
          JSON.stringify({
            merge: {
              id: "concept_merge_1",
              canonicalId: "concept_a",
              duplicateIds: ["concept_b"],
              createdAt: 0,
              undoneAt: null
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/concept/merge/concept_merge_1/undo")) {
        return new Response(
          JSON.stringify({
            merge: {
              id: "concept_merge_1",
              canonicalId: "concept_a",
              duplicateIds: ["concept_b"],
              createdAt: 0,
              undoneAt: 1
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.endsWith("/concept/concept_a/merges")) {
        return new Response(JSON.stringify({ merges: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const preview = await postConceptMergePreview({
      canonicalId: "concept_a",
      duplicateIds: ["concept_b"]
    });
    expect(preview.counts.edgesToRewire).toBe(1);

    const applied = await postConceptMergeApply({
      canonicalId: "concept_a",
      duplicateIds: ["concept_b"]
    });
    expect(applied.merge.id).toBe("concept_merge_1");

    const undone = await postConceptMergeUndo("concept_merge_1");
    expect(undone.merge.undoneAt).toBe(1);

    const merges = await getConceptMerges("concept_a");
    expect(merges.merges).toEqual([]);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("/api/concept/merge/preview");
    expect(urls).toContain("/api/concept/merge/apply");
    expect(urls).toContain("/api/concept/merge/concept_merge_1/undo");
    expect(urls).toContain("/api/concept/concept_a/merges");

    const previewCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/concept/merge/preview"));
    expect(previewCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(previewCall?.[1]?.body))).toEqual({
      canonicalId: "concept_a",
      duplicateIds: ["concept_b"]
    });

    const applyCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/concept/merge/apply"));
    expect(applyCall?.[1]?.method).toBe("POST");
  });
});
