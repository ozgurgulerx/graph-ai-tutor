import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const EdgeTypeSchema = z.enum([
  "PREREQUISITE_OF",
  "PART_OF",
  "USED_IN",
  "CONTRASTS_WITH",
  "ADDRESSES_FAILURE_MODE",
  "INTRODUCED_BY",
  "POPULARIZED_BY",
  "CONFUSED_WITH"
]);

export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const ConceptSchema = z.object({
  id: z.string(),
  title: z.string(),
  l0: z.string().nullable(),
  l1: z.array(z.string()),
  module: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type Concept = z.infer<typeof ConceptSchema>;

export const ConceptSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  module: z.string().nullable()
});

export type ConceptSummary = z.infer<typeof ConceptSummarySchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  fromConceptId: z.string(),
  toConceptId: z.string(),
  type: EdgeTypeSchema,
  sourceUrl: z.string().nullable(),
  confidence: z.number().nullable(),
  verifierScore: z.number().nullable(),
  evidenceChunkIds: z.array(z.string()),
  createdAt: z.number()
});

export type Edge = z.infer<typeof EdgeSchema>;

export const EdgeSummarySchema = z.object({
  id: z.string(),
  fromConceptId: z.string(),
  toConceptId: z.string(),
  type: EdgeTypeSchema
});

export type EdgeSummary = z.infer<typeof EdgeSummarySchema>;

export const GraphResponseSchema = z.object({
  nodes: z.array(ConceptSummarySchema),
  edges: z.array(EdgeSummarySchema)
});

export type GraphResponse = z.infer<typeof GraphResponseSchema>;

export const GetConceptParamsSchema = z.object({
  id: z.string()
});

export type GetConceptParams = z.infer<typeof GetConceptParamsSchema>;

export const GetConceptResponseSchema = z.object({
  concept: ConceptSchema
});

export type GetConceptResponse = z.infer<typeof GetConceptResponseSchema>;

const PostConceptCreateRequestSchema = z
  .object({
    title: z.string().min(1),
    l0: z.string().nullable().optional(),
    l1: z.array(z.string()).optional(),
    module: z.string().nullable().optional()
  })
  .strict();

const PostConceptUpdateRequestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    l0: z.string().nullable().optional(),
    l1: z.array(z.string()).optional(),
    module: z.string().nullable().optional()
  })
  .strict()
  .refine((val) => Object.keys(val).some((k) => k !== "id"), {
    message: "At least one field must be provided"
  });

export const PostConceptRequestSchema = z.union([
  PostConceptCreateRequestSchema,
  PostConceptUpdateRequestSchema
]);

export type PostConceptRequest = z.infer<typeof PostConceptRequestSchema>;

export const PostConceptResponseSchema = z.object({
  concept: ConceptSchema
});

export type PostConceptResponse = z.infer<typeof PostConceptResponseSchema>;

export const PostEdgeRequestSchema = z
  .object({
    fromConceptId: z.string().min(1),
    toConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    sourceUrl: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
    verifierScore: z.number().nullable().optional(),
    evidenceChunkIds: z.array(z.string().min(1)).default([])
  })
  .strict()
  .refine((val) => val.fromConceptId !== val.toConceptId, {
    message: "fromConceptId and toConceptId must differ",
    path: ["toConceptId"]
  });

export type PostEdgeRequest = z.infer<typeof PostEdgeRequestSchema>;

export const PostEdgeResponseSchema = z.object({
  edge: EdgeSchema
});

export type PostEdgeResponse = z.infer<typeof PostEdgeResponseSchema>;

export const SearchQuerySchema = z
  .object({
    q: z.string().optional().default("")
  })
  .strict();

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResponseSchema = z.object({
  results: z.array(ConceptSummarySchema),
  chunkResults: z.array(
    z.object({
      chunkId: z.string(),
      sourceId: z.string(),
      sourceUrl: z.string(),
      sourceTitle: z.string().nullable(),
      snippet: z.string()
    })
  )
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const IngestRequestSchema = z
  .object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    text: z.string().optional(),
    base64: z.string().optional(),
    url: z.string().optional(),
    title: z.string().optional()
  })
  .strict()
  .refine((val) => (typeof val.text === "string") !== (typeof val.base64 === "string"), {
    message: "Provide exactly one of text or base64"
  });

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestResponseSchema = z.object({
  sourceId: z.string(),
  chunkCount: z.number()
});

export type IngestResponse = z.infer<typeof IngestResponseSchema>;
