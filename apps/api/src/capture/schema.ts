import { z } from "zod";

import { EdgeTypeSchema } from "@graph-ai-tutor/shared";

export const CaptureProposedConceptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    l0: z.string().nullable(),
    l1: z.array(z.string()),
    module: z.string().nullable(),
    evidence: z.string().min(1),
    confidence: z.number().min(0).max(1)
  })
  .strict();

export type CaptureProposedConcept = z.infer<typeof CaptureProposedConceptSchema>;

export const CaptureProposedEdgeSchema = z
  .object({
    fromConceptId: z.string().min(1),
    toConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    evidence: z.string().min(1),
    confidence: z.number().min(0).max(1)
  })
  .strict()
  .refine((val) => val.fromConceptId !== val.toConceptId, {
    message: "fromConceptId and toConceptId must differ",
    path: ["toConceptId"]
  });

export type CaptureProposedEdge = z.infer<typeof CaptureProposedEdgeSchema>;

export const CaptureProposalSchema = z
  .object({
    concepts: z.array(CaptureProposedConceptSchema),
    edges: z.array(CaptureProposedEdgeSchema)
  })
  .strict()
  .refine((val) => val.concepts.length + val.edges.length > 0, {
    message: "At least one concept or edge must be proposed"
  });

export type CaptureProposal = z.infer<typeof CaptureProposalSchema>;

const EDGE_TYPES = EdgeTypeSchema.options as readonly string[];

export const CaptureProposalJsonSchema = {
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
          evidence: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["id", "title", "l0", "l1", "module", "evidence", "confidence"]
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
          evidence: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["fromConceptId", "toConceptId", "type", "evidence", "confidence"]
      }
    }
  },
  required: ["concepts", "edges"]
} as const;
