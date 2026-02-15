import { z } from "zod";

export type QuizType = "CLOZE" | "ORDERING_STEPS" | "COMPARE_CONTRAST";

export type QuizConceptInput = {
  id: string;
  title: string;
  l0: string | null;
  l1: string[];
  module: string | null;
};

export type QuizCandidateConcept = {
  id: string;
  title: string;
};

const QuizRubricSchema = z
  .object({
    explanation: z.string().min(1)
  })
  .strict();

const ClozeDraftSchema = z
  .object({
    type: z.literal("CLOZE"),
    prompt: z.string().min(1).refine((s) => s.includes("___"), {
      message: "Cloze prompt must include at least one blank: ___"
    }),
    answer: z
      .object({
        blanks: z.array(z.string().min(1)).min(1)
      })
      .strict()
  })
  .strict();

const OrderingDraftSchema = z
  .object({
    type: z.literal("ORDERING_STEPS"),
    prompt: z.string().min(1),
    answer: z
      .object({
        orderedSteps: z.array(z.string().min(1)).min(2).max(12)
      })
      .strict()
  })
  .strict();

const CompareDraftSchema = z
  .object({
    type: z.literal("COMPARE_CONTRAST"),
    prompt: z.string().min(1),
    answer: z
      .object({
        otherConceptId: z.string().min(1),
        otherConceptTitle: z.string().min(1),
        similarities: z.array(z.string().min(1)).min(1).max(8),
        differences: z.array(z.string().min(1)).min(1).max(8)
      })
      .strict()
  })
  .strict();

const QuizDraftItemSchema = z.discriminatedUnion("type", [
  ClozeDraftSchema,
  OrderingDraftSchema,
  CompareDraftSchema
]);

export const QuizDraftSchema = z
  .object({
    items: z.array(QuizDraftItemSchema).min(3).max(20)
  })
  .strict();

export type QuizDraft = z.infer<typeof QuizDraftSchema>;
export type QuizDraftItem = QuizDraft["items"][number];

const ClozeFinalSchema = ClozeDraftSchema.extend({
  rubric: QuizRubricSchema
}).strict();

const OrderingFinalSchema = OrderingDraftSchema.extend({
  rubric: QuizRubricSchema
}).strict();

const CompareFinalSchema = CompareDraftSchema.extend({
  rubric: QuizRubricSchema
}).strict();

const QuizFinalItemSchema = z.discriminatedUnion("type", [
  ClozeFinalSchema,
  OrderingFinalSchema,
  CompareFinalSchema
]);

export const QuizFinalSchema = z
  .object({
    items: z.array(QuizFinalItemSchema).min(3).max(20)
  })
  .strict();

export type QuizSpec = z.infer<typeof QuizFinalItemSchema>;

export const QuizDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 3,
      maxItems: 20,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CLOZE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  blanks: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: ["blanks"]
              }
            },
            required: ["type", "prompt", "answer"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["ORDERING_STEPS"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  orderedSteps: {
                    type: "array",
                    minItems: 2,
                    maxItems: 12,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: ["orderedSteps"]
              }
            },
            required: ["type", "prompt", "answer"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["COMPARE_CONTRAST"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  otherConceptId: { type: "string", minLength: 1 },
                  otherConceptTitle: { type: "string", minLength: 1 },
                  similarities: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: { type: "string", minLength: 1 }
                  },
                  differences: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: [
                  "otherConceptId",
                  "otherConceptTitle",
                  "similarities",
                  "differences"
                ]
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

export const QuizFinalJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 3,
      maxItems: 20,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["CLOZE"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  blanks: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: ["blanks"]
              },
              rubric: {
                type: "object",
                additionalProperties: false,
                properties: {
                  explanation: { type: "string", minLength: 1 }
                },
                required: ["explanation"]
              }
            },
            required: ["type", "prompt", "answer", "rubric"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["ORDERING_STEPS"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  orderedSteps: {
                    type: "array",
                    minItems: 2,
                    maxItems: 12,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: ["orderedSteps"]
              },
              rubric: {
                type: "object",
                additionalProperties: false,
                properties: {
                  explanation: { type: "string", minLength: 1 }
                },
                required: ["explanation"]
              }
            },
            required: ["type", "prompt", "answer", "rubric"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["COMPARE_CONTRAST"] },
              prompt: { type: "string", minLength: 1 },
              answer: {
                type: "object",
                additionalProperties: false,
                properties: {
                  otherConceptId: { type: "string", minLength: 1 },
                  otherConceptTitle: { type: "string", minLength: 1 },
                  similarities: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: { type: "string", minLength: 1 }
                  },
                  differences: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: { type: "string", minLength: 1 }
                  }
                },
                required: [
                  "otherConceptId",
                  "otherConceptTitle",
                  "similarities",
                  "differences"
                ]
              },
              rubric: {
                type: "object",
                additionalProperties: false,
                properties: {
                  explanation: { type: "string", minLength: 1 }
                },
                required: ["explanation"]
              }
            },
            required: ["type", "prompt", "answer", "rubric"]
          }
        ]
      }
    }
  },
  required: ["items"]
} as const;

export type QuizLlm = {
  proposeDraft: (input: {
    concept: QuizConceptInput;
    candidateConcepts: QuizCandidateConcept[];
    count: number;
  }) => Promise<unknown>;
  finalize: (input: {
    concept: QuizConceptInput;
    candidateConcepts: QuizCandidateConcept[];
    draft: QuizDraft;
  }) => Promise<unknown>;
};

type OpenAiResponsesResponse = {
  output?: unknown;
  [key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: unknown): string | undefined {
  if (!isObject(payload)) return undefined;
  const err = payload.error;
  if (!isObject(err)) return undefined;
  const msg = err.message;
  return typeof msg === "string" ? msg : undefined;
}

function getOutputTextFromResponse(response: OpenAiResponsesResponse): string {
  const output = response.output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!isObject(item)) continue;
    if (item.type !== "message") continue;

    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (!isObject(c)) continue;
      if (c.type !== "output_text") continue;
      const text = c.text;
      if (typeof text === "string") parts.push(text);
    }
  }

  return parts.join("");
}

function toJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

async function runOpenAiStructuredJson(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  schemaName: string;
  jsonSchema: unknown;
  system: string;
  user: string;
}): Promise<unknown> {
  const res = await fetch(`${input.baseUrl.replace(/\/+$/, "")}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      input: `SYSTEM:\n${input.system}\n\nUSER:\n${input.user}`,
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.jsonSchema
        }
      }
    })
  });

  if (!res.ok) {
    const payload = (await res.json().catch(async () => {
      const text = await res.text().catch(() => "");
      throw new Error(
        `OpenAI /responses returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
      );
    })) as unknown;
    const msg = getErrorMessage(payload) ?? `Request failed (${res.status} ${res.statusText})`;
    throw new Error(`OpenAI /responses error: ${msg}`);
  }

  const payload = (await res.json()) as unknown;
  if (!isObject(payload)) {
    throw new Error("OpenAI /responses returned unexpected payload");
  }

  const content = getOutputTextFromResponse(payload as OpenAiResponsesResponse).trim();
  if (!content) {
    throw new Error("OpenAI /responses had no output_text content to parse");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (err) {
    throw new Error(`OpenAI /responses output_text was not valid JSON: ${String(err)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireAllQuizTypes(items: Array<{ type: QuizType }>) {
  const types = new Set(items.map((i) => i.type));
  const missing: QuizType[] = [];
  for (const t of ["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST"] as const) {
    if (!types.has(t)) missing.push(t);
  }
  assert(missing.length === 0, `Missing quiz types: ${missing.join(", ")}`);
}

function validateCompareConceptRefs(input: {
  conceptId: string;
  candidates: QuizCandidateConcept[];
  items: QuizSpec[];
}) {
  const candidateIdSet = new Set(input.candidates.map((c) => c.id));
  for (const item of input.items) {
    if (item.type !== "COMPARE_CONTRAST") continue;
    assert(item.answer.otherConceptId !== input.conceptId, "COMPARE_CONTRAST otherConceptId must differ");
    assert(
      candidateIdSet.has(item.answer.otherConceptId),
      `COMPARE_CONTRAST otherConceptId not found in candidates: ${item.answer.otherConceptId}`
    );
  }
}

export function createOpenAiQuizLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  modelNano?: string;
  modelMini?: string;
} = {}): QuizLlm {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use the OpenAI quiz generator");
  }

  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const modelNano = options.modelNano ?? process.env.OPENAI_MODEL_NANO ?? "gpt-5-nano";
  const modelMini = options.modelMini ?? process.env.OPENAI_MODEL_MINI ?? "gpt-5-mini";

  return {
    async proposeDraft(input) {
      const system = [
        "You generate draft quiz items for a concept knowledge graph tutor.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "You MUST include at least one item of each type: CLOZE, ORDERING_STEPS, COMPARE_CONTRAST.",
        "CLOZE prompts must contain blanks using three underscores: ___.",
        "COMPARE_CONTRAST must choose otherConceptId from the provided candidateConcepts list."
      ].join("\n");

      const user = [
        `concept: ${toJson(input.concept)}`,
        `count: ${input.count}`,
        "candidateConcepts (id, title):",
        toJson(input.candidateConcepts)
      ].join("\n\n");

      return await runOpenAiStructuredJson({
        apiKey,
        baseUrl,
        model: modelNano,
        schemaName: "quiz_draft",
        jsonSchema: QuizDraftJsonSchema,
        system,
        user
      });
    },

    async finalize(input) {
      const system = [
        "You refine draft quiz items into final quiz items with answer keys and rubrics.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "You MUST include at least one item of each type: CLOZE, ORDERING_STEPS, COMPARE_CONTRAST.",
        "CLOZE prompts must contain blanks using three underscores: ___.",
        "Make prompts precise and technical; keep rubrics short."
      ].join("\n");

      const user = [
        `concept: ${toJson(input.concept)}`,
        "candidateConcepts (id, title):",
        toJson(input.candidateConcepts),
        "draft.items:",
        toJson(input.draft.items)
      ].join("\n\n");

      return await runOpenAiStructuredJson({
        apiKey,
        baseUrl,
        model: modelMini,
        schemaName: "quiz_final",
        jsonSchema: QuizFinalJsonSchema,
        system,
        user
      });
    }
  };
}

export function maybeCreateOpenAiQuizLlm(): QuizLlm | null {
  try {
    return createOpenAiQuizLlm();
  } catch {
    return null;
  }
}

export async function generateQuizSpecs(input: {
  concept: QuizConceptInput;
  candidateConcepts: QuizCandidateConcept[];
  count: number;
  llm: QuizLlm;
}): Promise<QuizSpec[]> {
  const draftRaw = await input.llm.proposeDraft({
    concept: input.concept,
    candidateConcepts: input.candidateConcepts,
    count: input.count
  });
  const draft = QuizDraftSchema.parse(draftRaw);
  requireAllQuizTypes(draft.items);

  const finalRaw = await input.llm.finalize({
    concept: input.concept,
    candidateConcepts: input.candidateConcepts,
    draft
  });
  const final = QuizFinalSchema.parse(finalRaw);
  requireAllQuizTypes(final.items);

  const items = final.items.slice(0, input.count);
  validateCompareConceptRefs({
    conceptId: input.concept.id,
    candidates: input.candidateConcepts,
    items
  });

  return items;
}
