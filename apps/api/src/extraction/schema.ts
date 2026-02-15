import { z } from "zod";

import { EdgeTypeSchema } from "@graph-ai-tutor/shared";

export const ExtractedConceptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    l0: z.string().nullable(),
    l1: z.array(z.string()),
    module: z.string().nullable(),
    evidenceChunkIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

export type ExtractedConcept = z.infer<typeof ExtractedConceptSchema>;

export const ExtractedEdgeSchema = z
  .object({
    fromConceptId: z.string().min(1),
    toConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    sourceUrl: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    verifierScore: z.number().min(0).max(1).nullable(),
    evidenceChunkIds: z.array(z.string().min(1)).min(1)
  })
  .strict()
  .refine((val) => val.fromConceptId !== val.toConceptId, {
    message: "fromConceptId and toConceptId must differ",
    path: ["toConceptId"]
  });

export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;

export const ExtractionCandidatesSchema = z
  .object({
    concepts: z.array(ExtractedConceptSchema),
    edges: z.array(ExtractedEdgeSchema)
  })
  .strict()
  .refine((val) => val.concepts.length + val.edges.length > 0, {
    message: "At least one concept or edge must be proposed"
  });

export type ExtractionCandidates = z.infer<typeof ExtractionCandidatesSchema>;

const EDGE_TYPES = EdgeTypeSchema.options as readonly string[];

export const ExtractionCandidatesJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          l0: { type: ["string", "null"] },
          l1: { type: "array", items: { type: "string" } },
          module: { type: ["string", "null"] },
          evidenceChunkIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          }
        },
        required: ["id", "title", "l0", "l1", "module", "evidenceChunkIds"]
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fromConceptId: { type: "string", minLength: 1 },
          toConceptId: { type: "string", minLength: 1 },
          type: { type: "string", enum: [...EDGE_TYPES] },
          sourceUrl: { type: ["string", "null"] },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          verifierScore: { type: ["number", "null"], minimum: 0, maximum: 1 },
          evidenceChunkIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          }
        },
        required: [
          "fromConceptId",
          "toConceptId",
          "type",
          "sourceUrl",
          "confidence",
          "verifierScore",
          "evidenceChunkIds"
        ]
      }
    }
  },
  required: ["concepts", "edges"]
} as const;

