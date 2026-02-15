import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  EdgeTypeSchema,
  PostConceptRequestSchema,
  PostEdgeRequestSchema,
  SearchQuerySchema
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

  it("defaults SearchQuery.q", () => {
    expect(SearchQuerySchema.parse({})).toEqual({ q: "" });
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
});
