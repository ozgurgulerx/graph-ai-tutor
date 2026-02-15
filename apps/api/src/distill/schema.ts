import { z } from "zod";

export const DistillOutputSchema = z
  .object({
    l1: z.array(z.string().min(1)).min(1).max(12),
    l2: z.array(z.string().min(1)).min(1).max(20)
  })
  .strict();

export type DistillOutput = z.infer<typeof DistillOutputSchema>;

export const DistillOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    l1: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 1 }
    },
    l2: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["l1", "l2"]
} as const;

