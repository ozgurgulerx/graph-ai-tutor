import {
  TrainingDraftSchema,
  TrainingFinalSchema,
  type TrainingSpec
} from "./schema";
import type { TrainingConceptInput, TrainingCandidateConcept, TrainingLlm } from "./llm";

export type TrainingQuestionType =
  | "MECHANISM_TRACE"
  | "FAILURE_MODE"
  | "CONTRAST_EXPLAIN"
  | "CODE_REASONING";

const ALL_TRAINING_TYPES: TrainingQuestionType[] = [
  "MECHANISM_TRACE",
  "FAILURE_MODE",
  "CONTRAST_EXPLAIN",
  "CODE_REASONING"
];

function requireMinTypes(items: Array<{ type: string }>, minTypes: number = 2) {
  const types = new Set(items.map((i) => i.type));
  const trainingTypes = ALL_TRAINING_TYPES.filter((t) => types.has(t));
  if (trainingTypes.length < minTypes) {
    throw new Error(
      `Expected at least ${minTypes} distinct training question types, got ${trainingTypes.length}: ${trainingTypes.join(", ")}`
    );
  }
}

export async function generateTrainingQuestions(input: {
  concept: TrainingConceptInput;
  candidateConcepts: TrainingCandidateConcept[];
  count: number;
  llm: TrainingLlm;
}): Promise<TrainingSpec[]> {
  const draftRaw = await input.llm.proposeDraft({
    concept: input.concept,
    candidateConcepts: input.candidateConcepts,
    count: input.count
  });
  const draft = TrainingDraftSchema.parse(draftRaw);
  requireMinTypes(draft.items);

  const finalRaw = await input.llm.finalize({
    concept: input.concept,
    candidateConcepts: input.candidateConcepts,
    draft
  });
  const final = TrainingFinalSchema.parse(finalRaw);
  requireMinTypes(final.items);

  return final.items.slice(0, input.count);
}
