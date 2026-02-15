import {
  createOpenAIResponsesClient,
  resolveModel,
  runStructuredOutput
} from "@graph-ai-tutor/llm";

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

function toJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

export function createOpenAiTrainingLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  modelNano?: string;
  modelMini?: string;
} = {}): TrainingLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const modelNano = options.modelNano ?? resolveModel("nano");
  const modelMini = options.modelMini ?? resolveModel("mini");

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

      const { data } = await runStructuredOutput<unknown>(client, {
        model: modelNano,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "training_draft",
          schema: TrainingDraftJsonSchema,
          strict: true
        }
      });

      return data;
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

      const { data } = await runStructuredOutput<unknown>(client, {
        model: modelMini,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "training_final",
          schema: TrainingFinalJsonSchema,
          strict: true
        }
      });

      return data;
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

      const { data } = await runStructuredOutput<unknown>(client, {
        model: modelMini,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "training_grade",
          schema: TrainingGradeJsonSchema,
          strict: true
        }
      });

      return data;
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
