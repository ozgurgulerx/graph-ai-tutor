import { z } from "zod";

import { EdgeTypeSchema, NodeKindSchema } from "@graph-ai-tutor/shared";

export const SmartAddEdgeSchema = z
  .object({
    existingConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    direction: z.enum(["to", "from"]),
    confidence: z.number().min(0).max(1),
    evidence: z.string()
  })
  .strict();

export type SmartAddEdge = z.infer<typeof SmartAddEdgeSchema>;

export const SmartAddProposalSchema = z
  .object({
    kind: NodeKindSchema,
    l0: z.string().nullable(),
    l1: z.array(z.string()),
    module: z.string().nullable(),
    edges: z.array(SmartAddEdgeSchema)
  })
  .strict();

export type SmartAddProposal = z.infer<typeof SmartAddProposalSchema>;

const EDGE_TYPES = EdgeTypeSchema.options as readonly string[];
const NODE_KINDS = NodeKindSchema.options as readonly string[];

export const SmartAddProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: [...NODE_KINDS] },
    l0: { type: ["string", "null"] },
    l1: { type: "array", items: { type: "string" } },
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
  required: ["kind", "l0", "l1", "module", "edges"]
} as const;
