import { describe, expect, it } from "vitest";

import { generateTrainingQuestions } from "./generate";
import type { TrainingLlm } from "./llm";

function createMockTrainingLlm(): TrainingLlm {
  return {
    async proposeDraft() {
      return {
        items: [
          {
            type: "MECHANISM_TRACE",
            prompt: "Explain step-by-step how gradient descent works.",
            answer: {
              keyPoints: ["compute gradients", "update weights", "learning rate"],
              expectedFlow: "Forward pass -> Loss computation -> Backpropagation -> Weight update"
            }
          },
          {
            type: "FAILURE_MODE",
            prompt: "What happens when the learning rate is too high?",
            answer: {
              failureConditions: ["learning rate too large"],
              consequences: ["loss diverges", "training becomes unstable"]
            }
          },
          {
            type: "CONTRAST_EXPLAIN",
            prompt: "Compare SGD and Adam optimizers.",
            answer: {
              otherConceptId: "c2",
              otherConceptTitle: "Adam Optimizer",
              similarities: ["Both are gradient-based optimizers"],
              differences: ["Adam uses adaptive learning rates"]
            }
          },
          {
            type: "CODE_REASONING",
            prompt: "What is the output of: x = torch.tensor([1.0], requires_grad=True); y = x * 2; y.backward(); print(x.grad)",
            answer: {
              expectedOutput: "tensor([2.])",
              explanation: "The gradient of y=2x with respect to x is 2"
            }
          }
        ]
      };
    },
    async finalize() {
      return {
        items: [
          {
            type: "MECHANISM_TRACE",
            prompt: "Explain step-by-step how gradient descent works.",
            answer: {
              keyPoints: ["compute gradients", "update weights", "learning rate"],
              expectedFlow: "Forward pass -> Loss computation -> Backpropagation -> Weight update"
            },
            rubric: {
              explanation: "Student should describe the iterative optimization process.",
              keyTerms: ["gradient", "loss", "backpropagation"],
              scoringCriteria: "Correct if mentions all key steps."
            }
          },
          {
            type: "FAILURE_MODE",
            prompt: "What happens when the learning rate is too high?",
            answer: {
              failureConditions: ["learning rate too large"],
              consequences: ["loss diverges", "training becomes unstable"]
            },
            rubric: {
              explanation: "Student should identify divergence behavior.",
              keyTerms: ["diverge", "oscillate"],
              scoringCriteria: "Correct if identifies instability."
            }
          },
          {
            type: "CONTRAST_EXPLAIN",
            prompt: "Compare SGD and Adam optimizers.",
            answer: {
              otherConceptId: "c2",
              otherConceptTitle: "Adam Optimizer",
              similarities: ["Both are gradient-based optimizers"],
              differences: ["Adam uses adaptive learning rates"]
            },
            rubric: {
              explanation: "Should compare both optimizers.",
              keyTerms: ["adaptive", "momentum"],
              scoringCriteria: "Correct if identifies key differences."
            }
          },
          {
            type: "CODE_REASONING",
            prompt: "What is the output?",
            answer: {
              expectedOutput: "tensor([2.])",
              explanation: "The gradient of y=2x with respect to x is 2"
            },
            rubric: {
              explanation: "Should identify the gradient value.",
              keyTerms: ["gradient", "autograd"],
              scoringCriteria: "Correct if output matches."
            }
          }
        ]
      };
    },
    async gradeAnswer() {
      return { grade: "correct", feedback: "Good answer!" };
    }
  };
}

describe("generateTrainingQuestions", () => {
  it("generates training questions using two-pass LLM pipeline", async () => {
    const llm = createMockTrainingLlm();
    const specs = await generateTrainingQuestions({
      concept: {
        id: "c1",
        title: "Gradient Descent",
        l0: "An optimization algorithm",
        l1: ["Step 1", "Step 2"],
        module: "optimization"
      },
      candidateConcepts: [{ id: "c2", title: "Adam Optimizer" }],
      count: 4,
      llm
    });

    expect(specs.length).toBe(4);
    const types = new Set(specs.map((s) => s.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
    expect(specs.every((s) => "rubric" in s)).toBe(true);
  });

  it("limits results to count", async () => {
    const llm = createMockTrainingLlm();
    const specs = await generateTrainingQuestions({
      concept: {
        id: "c1",
        title: "Test",
        l0: null,
        l1: [],
        module: null
      },
      candidateConcepts: [{ id: "c2", title: "Other" }],
      count: 2,
      llm
    });

    expect(specs.length).toBe(2);
  });
});
