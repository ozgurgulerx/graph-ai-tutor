import { describe, expect, it } from "vitest";

import { gradeTrainingAnswer } from "./grade";
import type { TrainingLlm } from "./llm";

function createMockGradingLlm(grade: string = "correct", feedback: string = "Good!"): TrainingLlm {
  return {
    async proposeDraft() {
      return { items: [] };
    },
    async finalize() {
      return { items: [] };
    },
    async gradeAnswer() {
      return { grade, feedback };
    }
  };
}

describe("gradeTrainingAnswer", () => {
  it("grades MECHANISM_TRACE using key-term matching when enough terms match", async () => {
    const result = await gradeTrainingAnswer({
      questionType: "MECHANISM_TRACE",
      prompt: "Explain how gradient descent works.",
      answer: {
        keyPoints: ["compute gradients", "update weights", "learning rate"],
        expectedFlow: "Forward -> Backward -> Update"
      },
      rubric: {
        explanation: "Check key steps",
        keyTerms: ["gradient", "loss"]
      },
      userAnswer:
        "Gradient descent computes gradients of the loss function and uses the learning rate to update weights iteratively.",
      llm: createMockGradingLlm()
    });

    expect(result.grade).toBe("correct");
    expect(result.feedback).toContain("key points");
  });

  it("returns partial for MECHANISM_TRACE when some terms match", async () => {
    const result = await gradeTrainingAnswer({
      questionType: "MECHANISM_TRACE",
      prompt: "Explain how gradient descent works.",
      answer: {
        keyPoints: ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"],
        expectedFlow: "Step A -> Step B -> Step C"
      },
      rubric: {
        explanation: "Check key steps",
        keyTerms: ["golf", "hotel", "india", "juliet"]
      },
      userAnswer: "Alpha and bravo are important. Also golf and hotel matter.",
      llm: createMockGradingLlm()
    });

    expect(result.grade).toBe("partial");
    expect(result.feedback).toContain("missed");
  });

  it("falls back to LLM grading for FAILURE_MODE type", async () => {
    const result = await gradeTrainingAnswer({
      questionType: "FAILURE_MODE",
      prompt: "What happens when memory runs out?",
      answer: {
        failureConditions: ["out of memory"],
        consequences: ["process crashes"]
      },
      rubric: {
        explanation: "Should describe OOM behavior"
      },
      userAnswer: "The process will be killed by the OOM killer.",
      llm: createMockGradingLlm("correct", "Correctly identified OOM behavior.")
    });

    expect(result.grade).toBe("correct");
    expect(result.feedback).toBe("Correctly identified OOM behavior.");
  });

  it("falls back to LLM grading for CODE_REASONING type", async () => {
    const result = await gradeTrainingAnswer({
      questionType: "CODE_REASONING",
      prompt: "What does this code output?",
      answer: {
        expectedOutput: "42",
        explanation: "The function returns 42"
      },
      rubric: { explanation: "Check output value" },
      userAnswer: "The output is 42.",
      llm: createMockGradingLlm("correct", "Correct output!")
    });

    expect(result.grade).toBe("correct");
    expect(result.feedback).toBe("Correct output!");
  });

  it("falls back to LLM for MECHANISM_TRACE when no key terms match", async () => {
    const result = await gradeTrainingAnswer({
      questionType: "MECHANISM_TRACE",
      prompt: "Explain convolution.",
      answer: {
        keyPoints: ["kernel", "stride", "feature map", "padding"],
        expectedFlow: "Apply kernel -> Slide across input -> Generate feature map"
      },
      rubric: {
        explanation: "Check understanding",
        keyTerms: ["filter", "receptive field"]
      },
      userAnswer: "I have no idea how this works.",
      llm: createMockGradingLlm("wrong", "The answer does not address the question.")
    });

    expect(result.grade).toBe("wrong");
    expect(result.feedback).toBe("The answer does not address the question.");
  });
});
