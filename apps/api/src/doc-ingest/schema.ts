import { z } from "zod";

import { EdgeTypeSchema, NodeKindSchema } from "@graph-ai-tutor/shared";

export const DocIngestDeltaSchema = z
  .object({
    conceptId: z.string().min(1),
    l0: z.string().nullable(),
    newL1: z.array(z.string()),
    evidence: z.string(),
    confidence: z.number().min(0).max(1)
  })
  .strict();

export type DocIngestDelta = z.infer<typeof DocIngestDeltaSchema>;

export const DocIngestNewConceptEdgeSchema = z
  .object({
    existingConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    direction: z.enum(["to", "from"]),
    confidence: z.number().min(0).max(1),
    evidence: z.string()
  })
  .strict();

export type DocIngestNewConceptEdge = z.infer<typeof DocIngestNewConceptEdgeSchema>;

export const DocIngestNewConceptSchema = z
  .object({
    title: z.string().min(1),
    l0: z.string().nullable(),
    l1: z.array(z.string()),
    kind: NodeKindSchema,
    module: z.string().nullable(),
    edges: z.array(DocIngestNewConceptEdgeSchema)
  })
  .strict();

export type DocIngestNewConcept = z.infer<typeof DocIngestNewConceptSchema>;

export const DocIngestProposalSchema = z
  .object({
    deltas: z.array(DocIngestDeltaSchema),
    newConcepts: z.array(DocIngestNewConceptSchema)
  })
  .strict();

export type DocIngestProposal = z.infer<typeof DocIngestProposalSchema>;

const EDGE_TYPES = EdgeTypeSchema.options as readonly string[];
const NODE_KINDS = NodeKindSchema.options as readonly string[];

export const DocIngestProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    deltas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          conceptId: { type: "string", minLength: 1 },
          l0: { type: ["string", "null"] },
          newL1: { type: "array", items: { type: "string" } },
          evidence: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["conceptId", "l0", "newL1", "evidence", "confidence"]
      }
    },
    newConcepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1 },
          l0: { type: ["string", "null"] },
          l1: { type: "array", items: { type: "string" } },
          kind: { type: "string", enum: [...NODE_KINDS] },
          module: { type: ["string", "null"] },
          edges: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                existingConceptId: { type: "string", minLength: 1 },
                type: { type: "string", enum: [...EDGE_TYPES] },
                direction: { type: "string", enum: ["to", "from"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                evidence: { type: "string" }
              },
              required: ["existingConceptId", "type", "direction", "confidence", "evidence"]
            }
          }
        },
        required: ["title", "l0", "l1", "kind", "module", "edges"]
      }
    }
  },
  required: ["deltas", "newConcepts"]
} as const;
