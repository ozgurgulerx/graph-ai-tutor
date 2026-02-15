import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  ConceptSchema,
  EdgeTypeSchema,
  EvidenceChunkSchema,
  GraphLensQuerySchema,
  PostConceptSourceRequestSchema,
  PostConceptLocalSourceRequestSchema,
  PostSourceContentRequestSchema,
  PostCrawlRequestSchema,
  PostChangesetItemStatusRequestSchema,
  PostConceptRequestSchema,
  PostConceptMergePreviewRequestSchema,
  PostConceptMergePreviewResponseSchema,
  ConceptMergeSchema,
  PostEdgeRequestSchema,
  PostTutorRequestSchema,
  SearchQuerySchema,
  TrainingQuizItemSchema,
  TrainingSessionItemSchema,
  TrainingSessionSchema,
  PostCreateTrainingSessionRequestSchema,
  PostSubmitTrainingAnswerRequestSchema,
  TutorAnswerSchema,
  GetConceptNoteResponseSchema,
  PostConceptNoteRequestSchema,
  PostConceptNoteResponseSchema,
  GetConceptBacklinksResponseSchema
} from "./api-v1";

describe("api-v1 schemas", () => {
  it("parses ApiError", () => {
    expect(
      ApiErrorSchema.parse({
        error: { code: "VALIDATION_ERROR", message: "bad request", details: {} }
      })
    ).toEqual({
      error: { code: "VALIDATION_ERROR", message: "bad request", details: {} }
    });
  });

  it("parses EdgeType", () => {
    expect(EdgeTypeSchema.parse("PREREQUISITE_OF")).toBe("PREREQUISITE_OF");
  });

  it("rejects PostConceptRequest with id only", () => {
    expect(PostConceptRequestSchema.safeParse({ id: "concept_1" }).success).toBe(
      false
    );
  });

  it("rejects PostConceptSourceRequest with an invalid url", () => {
    expect(PostConceptSourceRequestSchema.safeParse({ url: "not-a-url" }).success).toBe(
      false
    );
  });

  it("rejects PostCrawlRequest with an invalid url", () => {
    expect(PostCrawlRequestSchema.safeParse({ url: "nope" }).success).toBe(false);
  });

  it("rejects PostConceptLocalSourceRequest with empty title", () => {
    expect(PostConceptLocalSourceRequestSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects PostSourceContentRequest without content", () => {
    expect(PostSourceContentRequestSchema.safeParse({}).success).toBe(false);
  });

  it("defaults SearchQuery.q", () => {
    expect(SearchQuerySchema.parse({})).toEqual({ q: "", mode: "concept" });
  });

  it("allows empty PostEdgeRequest.evidenceChunkIds", () => {
    expect(
      PostEdgeRequestSchema.parse({
        fromConceptId: "concept_a",
        toConceptId: "concept_b",
        type: "PREREQUISITE_OF",
        evidenceChunkIds: []
      }).evidenceChunkIds
    ).toEqual([]);
  });

  it("parses PostChangesetItemStatusRequest", () => {
    expect(PostChangesetItemStatusRequestSchema.parse({ status: "accepted" })).toEqual({
      status: "accepted"
    });
    expect(PostChangesetItemStatusRequestSchema.safeParse({ status: "applied" }).success).toBe(
      false
    );
  });

  it("accepts seed:// urls in EvidenceChunk.sourceUrl", () => {
    expect(
      EvidenceChunkSchema.parse({
        id: "chunk_1",
        sourceId: "source_1",
        content: "text",
        sourceUrl: "seed://kv-cache",
        sourceTitle: null
      }).sourceUrl
    ).toBe("seed://kv-cache");
  });

  it("rejects TutorAnswerSchema without citations", () => {
    expect(
      TutorAnswerSchema.safeParse({
        answer_markdown: "hi",
        cited_chunk_ids: [],
        used_concept_ids: [],
        used_edge_ids: []
      }).success
    ).toBe(false);
  });

  it("rejects PostTutorRequest with empty question", () => {
    expect(PostTutorRequestSchema.safeParse({ question: "" }).success).toBe(false);
  });

  it("parses concept merge preview/apply schemas", () => {
    expect(
      PostConceptMergePreviewRequestSchema.parse({
        canonicalId: "concept_a",
        duplicateIds: ["concept_b"]
      })
    ).toEqual({ canonicalId: "concept_a", duplicateIds: ["concept_b"] });

    const preview = PostConceptMergePreviewResponseSchema.parse({
      canonical: { id: "concept_a", title: "A", module: null },
      duplicates: [{ id: "concept_b", title: "B", module: null }],
      edgeChanges: [],
      counts: {
        edgesToRewire: 0,
        edgesToDelete: 0,
        reviewItemsToUpdate: 0,
        sourcesToMove: 0
      }
    });
    expect(preview.canonical.id).toBe("concept_a");

    expect(
      ConceptMergeSchema.parse({
        id: "concept_merge_1",
        canonicalId: "concept_a",
        duplicateIds: ["concept_b"],
        createdAt: 0,
        undoneAt: null
      }).duplicateIds
    ).toEqual(["concept_b"]);
  });

  it("parses TrainingSessionSchema", () => {
    const session = TrainingSessionSchema.parse({
      id: "ts_1",
      status: "active",
      conceptIds: ["c1", "c2"],
      questionCount: 4,
      correctCount: 1,
      partialCount: 1,
      wrongCount: 0,
      startedAt: Date.now(),
      completedAt: null
    });
    expect(session.id).toBe("ts_1");
    expect(session.status).toBe("active");
    expect(session.conceptIds).toEqual(["c1", "c2"]);
  });

  it("parses TrainingSessionItemSchema", () => {
    const item = TrainingSessionItemSchema.parse({
      id: "tsi_1",
      sessionId: "ts_1",
      reviewItemId: "ri_1",
      position: 0,
      userAnswer: "some answer",
      grade: "correct",
      feedback: "Good!",
      gradedAt: Date.now(),
      createdAt: Date.now()
    });
    expect(item.grade).toBe("correct");
  });

  it("parses TrainingQuizItemSchema for MECHANISM_TRACE", () => {
    const q = TrainingQuizItemSchema.parse({
      id: "ri_1",
      conceptId: "c1",
      type: "MECHANISM_TRACE",
      prompt: "Explain gradient descent.",
      answer: {
        keyPoints: ["compute gradients", "update weights"],
        expectedFlow: "Forward -> Backward"
      },
      rubric: {
        explanation: "Check steps.",
        keyTerms: ["gradient"],
        scoringCriteria: "Cover steps."
      },
      status: "active",
      dueAt: Date.now(),
      ease: 2.5,
      interval: 0,
      reps: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    expect(q.type).toBe("MECHANISM_TRACE");
    if (!("keyPoints" in q.answer)) {
      throw new Error("Expected keyPoints in MECHANISM_TRACE answer");
    }
    expect(q.answer.keyPoints).toContain("compute gradients");
  });

  it("parses PostCreateTrainingSessionRequestSchema", () => {
    const req = PostCreateTrainingSessionRequestSchema.parse({
      conceptIds: ["c1", "c2"]
    });
    expect(req.conceptIds).toEqual(["c1", "c2"]);

    // Also accepts empty body
    const empty = PostCreateTrainingSessionRequestSchema.parse({});
    expect(empty.conceptIds).toBeUndefined();
  });

  it("parses PostSubmitTrainingAnswerRequestSchema", () => {
    const req = PostSubmitTrainingAnswerRequestSchema.parse({
      answer: "My answer text"
    });
    expect(req.answer).toBe("My answer text");
  });

  it("GraphLensQuery defaults: center only → radius=1, edgeTypes=[]", () => {
    const result = GraphLensQuerySchema.parse({ center: "a" });
    expect(result).toEqual({ center: "a", radius: 1, edgeTypes: [] });
  });

  it("GraphLensQuery parses comma-separated edgeTypes", () => {
    const result = GraphLensQuerySchema.parse({
      center: "x",
      edgeTypes: "PREREQUISITE_OF,PART_OF"
    });
    expect(result.edgeTypes).toEqual(["PREREQUISITE_OF", "PART_OF"]);
  });

  it("GraphLensQuery rejects missing center", () => {
    expect(GraphLensQuerySchema.safeParse({}).success).toBe(false);
  });

  it("GraphLensQuery rejects radius=0 and radius=4", () => {
    expect(GraphLensQuerySchema.safeParse({ center: "a", radius: 0 }).success).toBe(false);
    expect(GraphLensQuerySchema.safeParse({ center: "a", radius: 4 }).success).toBe(false);
  });

  it("ConceptSchema defaults noteSourceId to null when omitted", () => {
    const result = ConceptSchema.parse({
      id: "c1",
      title: "Test",
      l0: null,
      l1: [],
      l2: [],
      module: null,
      createdAt: 0,
      updatedAt: 0
    });
    expect(result.noteSourceId).toBeNull();
  });

  it("ConceptSchema accepts noteSourceId as string", () => {
    const result = ConceptSchema.parse({
      id: "c1",
      title: "Test",
      l0: null,
      l1: [],
      l2: [],
      module: null,
      noteSourceId: "source_123",
      createdAt: 0,
      updatedAt: 0
    });
    expect(result.noteSourceId).toBe("source_123");
  });

  it("parses GetConceptNoteResponse with source", () => {
    const result = GetConceptNoteResponseSchema.parse({
      source: { id: "s1", url: "vault://notes/note.md", title: "Note", createdAt: 0 },
      content: "# Hello"
    });
    expect(result.source?.id).toBe("s1");
    expect(result.content).toBe("# Hello");
  });

  it("parses GetConceptNoteResponse with null source", () => {
    const result = GetConceptNoteResponseSchema.parse({ source: null, content: "" });
    expect(result.source).toBeNull();
  });

  it("parses PostConceptNoteRequest with empty body", () => {
    const result = PostConceptNoteRequestSchema.parse({});
    expect(result).toEqual({});
  });

  it("parses PostConceptNoteRequest with title", () => {
    const result = PostConceptNoteRequestSchema.parse({ title: "My note" });
    expect(result.title).toBe("My note");
  });

  it("rejects PostConceptNoteRequest with extra fields", () => {
    expect(PostConceptNoteRequestSchema.safeParse({ title: "ok", extra: 1 }).success).toBe(false);
  });

  it("parses PostConceptNoteResponse", () => {
    const result = PostConceptNoteResponseSchema.parse({
      source: { id: "s1", url: "vault://notes/note.md", title: "Note", createdAt: 0 }
    });
    expect(result.source.id).toBe("s1");
  });

  it("parses GetConceptBacklinksResponse", () => {
    const result = GetConceptBacklinksResponseSchema.parse({
      concepts: [
        { id: "c1", title: "A", module: null }
      ]
    });
    expect(result.concepts).toHaveLength(1);
    expect(result.concepts[0].id).toBe("c1");
  });
});
