import { z } from "zod";

// --- Draft schemas (no rubric) ---

const MechanismTraceDraftSchema = z
  .object({
    type: z.literal("MECHANISM_TRACE"),
    prompt: z.string().min(1),
    answer: z
      .object({
        keyPoints: z.array(z.string().min(1)).min(1),
        expectedFlow: z.string().min(1)
      })
      .strict()
  })
  .strict();

const FailureModeDraftSchema = z
  .object({
    type: z.literal("FAILURE_MODE"),
    prompt: z.string().min(1),
    answer: z
      .object({
        failureConditions: z.array(z.string().min(1)).min(1),
        consequences: z.array(z.string().min(1)).min(1)
      })
      .strict()
  })
  .strict();

const ContrastExplainDraftSchema = z
  .object({
    type: z.literal("CONTRAST_EXPLAIN"),
    prompt: z.string().min(1),
    answer: z
      .object({
        otherConceptId: z.string().min(1),
        otherConceptTitle: z.string().min(1),
        similarities: z.array(z.string().min(1)).min(1),
        differences: z.array(z.string().min(1)).min(1)
      })
      .strict()
  })
  .strict();

const CodeReasoningDraftSchema = z
  .object({
    type: z.literal("CODE_REASONING"),
    prompt: z.string().min(1),
    answer: z
      .object({
        expectedOutput: z.string().min(1),
        explanation: z.string().min(1)
      })
      .strict()
  })
  .strict();

const TrainingDraftItemSchema = z.discriminatedUnion("type", [
  MechanismTraceDraftSchema,
  FailureModeDraftSchema,
  ContrastExplainDraftSchema,
  CodeReasoningDraftSchema
]);

export const TrainingDraftSchema = z
  .object({
    items: z.array(TrainingDraftItemSchema).min(2).max(12)
  })
  .strict();

export type TrainingDraft = z.infer<typeof TrainingDraftSchema>;
export type TrainingDraftItem = TrainingDraft["items"][number];

// --- Final schemas (with rubric) ---

const TrainingRubricZod = z
  .object({
    explanation: z.string().min(1),
    keyTerms: z.array(z.string()).optional(),
    scoringCriteria: z.string().optional()
  })
  .strict();

const MechanismTraceFinalSchema = MechanismTraceDraftSchema.extend({
  rubric: TrainingRubricZod
}).strict();

const FailureModeFinalSchema = FailureModeDraftSchema.extend({
  rubric: TrainingRubricZod
}).strict();

const ContrastExplainFinalSchema = ContrastExplainDraftSchema.extend({
  rubric: TrainingRubricZod
}).strict();

const CodeReasoningFinalSchema = CodeReasoningDraftSchema.extend({
  rubric: TrainingRubricZod
}).strict();

const TrainingFinalItemSchema = z.discriminatedUnion("type", [
  MechanismTraceFinalSchema,
  FailureModeFinalSchema,
  ContrastExplainFinalSchema,
  CodeReasoningFinalSchema
]);

export const TrainingFinalSchema = z
  .object({
    items: z.array(TrainingFinalItemSchema).min(2).max(12)
  })
  .strict();

export type TrainingSpec = z.infer<typeof TrainingFinalItemSchema>;

// --- Grade schema ---

export const TrainingGradeResultSchema = z
  .object({
    grade: z.enum(["correct", "partial", "wrong"]),
    feedback: z.string().min(1)
  })
  .strict();

export type TrainingGradeResult = z.infer<typeof TrainingGradeResultSchema>;

// --- JSON Schemas for OpenAI structured output ---

const rubricJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    explanation: { type: "string", minLength: 1 },
    keyTerms: { type: "array", items: { type: "string" } },
    scoringCriteria: { type: "string" }
  },
  required: ["explanation", "keyTerms", "scoringCriteria"]
} as const;

export const TrainingDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["MECHANISM_TRACE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  keyPoints: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  expectedFlow: { type: "string", minLength: 1 }
                },
                required: ["keyPoints", "expectedFlow"]
              }
            },
            required: ["type", "prompt", "answer"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["FAILURE_MODE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  failureConditions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  consequences: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
                },
                required: ["failureConditions", "consequences"]
              }
            },
            required: ["type", "prompt", "answer"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CONTRAST_EXPLAIN"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  otherConceptId: { type: "string", minLength: 1 },
                  otherConceptTitle: { type: "string", minLength: 1 },
                  similarities: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  differences: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
                },
                required: ["otherConceptId", "otherConceptTitle", "similarities", "differences"]
              }
            },
            required: ["type", "prompt", "answer"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CODE_REASONING"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  expectedOutput: { type: "string", minLength: 1 },
                  explanation: { type: "string", minLength: 1 }
                },
                required: ["expectedOutput", "explanation"]
              }
            },
            required: ["type", "prompt", "answer"]
          }
        ]
      }
    }
  },
  required: ["items"]
} as const;

export const TrainingFinalJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["MECHANISM_TRACE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  keyPoints: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  expectedFlow: { type: "string", minLength: 1 }
                },
                required: ["keyPoints", "expectedFlow"]
              },
              rubric: rubricJsonSchema
            },
            required: ["type", "prompt", "answer", "rubric"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["FAILURE_MODE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  failureConditions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  consequences: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
                },
                required: ["failureConditions", "consequences"]
              },
              rubric: rubricJsonSchema
            },
            required: ["type", "prompt", "answer", "rubric"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CONTRAST_EXPLAIN"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  otherConceptId: { type: "string", minLength: 1 },
                  otherConceptTitle: { type: "string", minLength: 1 },
                  similarities: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                  differences: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
                },
                required: ["otherConceptId", "otherConceptTitle", "similarities", "differences"]
              },
              rubric: rubricJsonSchema
            },
            required: ["type", "prompt", "answer", "rubric"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CODE_REASONING"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  expectedOutput: { type: "string", minLength: 1 },
                  explanation: { type: "string", minLength: 1 }
                },
                required: ["expectedOutput", "explanation"]
              },
              rubric: rubricJsonSchema
            },
            required: ["type", "prompt", "answer", "rubric"]
          }
        ]
      }
    }
  },
  required: ["items"]
} as const;

export const TrainingGradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    grade: { type: "string", enum: ["correct", "partial", "wrong"] },
    feedback: { type: "string", minLength: 1 }
  },
  required: ["grade", "feedback"]
} as const;
