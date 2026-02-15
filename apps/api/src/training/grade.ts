import { TrainingGradeResultSchema, type TrainingGradeResult } from "./schema";
import type { TrainingLlm } from "./llm";

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function keyTermMatch(userAnswer: string, keyTerms: string[]): number {
  if (keyTerms.length === 0) return 0;
  const normalized = normalizeForComparison(userAnswer);
  let matched = 0;
  for (const term of keyTerms) {
    if (normalized.includes(normalizeForComparison(term))) {
      matched++;
    }
  }
  return matched / keyTerms.length;
}

function objectiveGradeForMechanismTrace(
  userAnswer: string,
  answer: { keyPoints: string[]; expectedFlow: string },
  rubric: { keyTerms?: string[] }
): TrainingGradeResult | null {
  const keyTerms = rubric.keyTerms ?? [];
  const allTerms = [...keyTerms, ...answer.keyPoints];

  if (allTerms.length === 0) return null;

  const score = keyTermMatch(userAnswer, allTerms);

  if (score >= 0.7) {
    return {
      grade: "correct",
      feedback: `Good explanation! You covered ${Math.round(score * 100)}% of the key points.`
    };
  }
  if (score >= 0.35) {
    const missed = allTerms.filter(
      (t) => !normalizeForComparison(userAnswer).includes(normalizeForComparison(t))
    );
    return {
      grade: "partial",
      feedback: `Partially correct. You missed some key points: ${missed.slice(0, 3).join(", ")}.`
    };
  }

  return null;
}

export async function gradeTrainingAnswer(input: {
  questionType: string;
  prompt: string;
  answer: unknown;
  rubric: unknown;
  userAnswer: string;
  llm: TrainingLlm;
}): Promise<TrainingGradeResult> {
  // For MECHANISM_TRACE, try objective key-term matching first
  if (input.questionType === "MECHANISM_TRACE") {
    const ans = input.answer as { keyPoints?: string[]; expectedFlow?: string };
    const rub = input.rubric as { keyTerms?: string[] };
    if (ans?.keyPoints && ans?.expectedFlow) {
      const objective = objectiveGradeForMechanismTrace(
        input.userAnswer,
        { keyPoints: ans.keyPoints, expectedFlow: ans.expectedFlow },
        { keyTerms: rub?.keyTerms }
      );
      if (objective) return objective;
    }
  }

  // Fall back to LLM grading
  const raw = await input.llm.gradeAnswer({
    prompt: input.prompt,
    questionType: input.questionType,
    expectedAnswer: input.answer,
    rubric: input.rubric,
    userAnswer: input.userAnswer
  });

  return TrainingGradeResultSchema.parse(raw);
}
