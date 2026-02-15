import type { TrainingDraft } from "./schema";
import {
  TrainingDraftJsonSchema,
  TrainingFinalJsonSchema,
  TrainingGradeJsonSchema
} from "./schema";

export type TrainingConceptInput = {
  id: string;
  title: string;
  l0: string | null;
  l1: string[];
  module: string | null;
};

export type TrainingCandidateConcept = {
  id: string;
  title: string;
};

export type TrainingLlm = {
  proposeDraft: (input: {
    concept: TrainingConceptInput;
    candidateConcepts: TrainingCandidateConcept[];
    count: number;
  }) => Promise<unknown>;
  finalize: (input: {
    concept: TrainingConceptInput;
    candidateConcepts: TrainingCandidateConcept[];
    draft: TrainingDraft;
  }) => Promise<unknown>;
  gradeAnswer: (input: {
    prompt: string;
    questionType: string;
    expectedAnswer: unknown;
    rubric: unknown;
    userAnswer: string;
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

export function createOpenAiTrainingLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  modelNano?: string;
  modelMini?: string;
} = {}): TrainingLlm {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use training question generation");
  }

  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const modelNano = options.modelNano ?? process.env.OPENAI_MODEL_NANO ?? "gpt-5-nano";
  const modelMini = options.modelMini ?? process.env.OPENAI_MODEL_MINI ?? "gpt-5-mini";

  return {
    async proposeDraft(input) {
      const system = [
        "You generate training questions for deep understanding of concepts in a knowledge graph tutor.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "You MUST include at least 2 of these types: MECHANISM_TRACE, FAILURE_MODE, CONTRAST_EXPLAIN, CODE_REASONING.",
        "MECHANISM_TRACE: ask to explain step-by-step how something works, provide keyPoints for grading.",
        "FAILURE_MODE: ask what happens when something fails or what conditions cause failure.",
        "CONTRAST_EXPLAIN: compare two concepts (use otherConceptId from candidateConcepts).",
        "CODE_REASONING: given a code snippet, ask what the output is and why."
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
        schemaName: "training_draft",
        jsonSchema: TrainingDraftJsonSchema,
        system,
        user
      });
    },

    async finalize(input) {
      const system = [
        "You refine draft training questions into final items with rubrics.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "Include keyTerms in rubrics: terms that must appear in a correct answer.",
        "Include scoringCriteria: brief description of what constitutes correct/partial/wrong.",
        "Make prompts precise and technical."
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
        schemaName: "training_final",
        jsonSchema: TrainingFinalJsonSchema,
        system,
        user
      });
    },

    async gradeAnswer(input) {
      const system = [
        "You grade a student's free-text answer to a training question.",
        "Compare the answer against the expected answer and rubric.",
        "Return a grade: 'correct' if substantially right, 'partial' if partially right, 'wrong' if incorrect.",
        "Return constructive feedback explaining what was right/wrong."
      ].join("\n");

      const user = [
        `Question type: ${input.questionType}`,
        `Question: ${input.prompt}`,
        `Expected answer: ${toJson(input.expectedAnswer)}`,
        `Rubric: ${toJson(input.rubric)}`,
        `Student answer: ${input.userAnswer}`
      ].join("\n\n");

      return await runOpenAiStructuredJson({
        apiKey,
        baseUrl,
        model: modelMini,
        schemaName: "training_grade",
        jsonSchema: TrainingGradeJsonSchema,
        system,
        user
      });
    }
  };
}

export function maybeCreateOpenAiTrainingLlm(): TrainingLlm | null {
  try {
    return createOpenAiTrainingLlm();
  } catch {
    return null;
  }
}
