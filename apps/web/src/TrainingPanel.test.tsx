import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrainingPanel } from "./TrainingPanel";

vi.mock("./api/client", () => ({
  postCreateTrainingSession: vi.fn().mockResolvedValue({
    session: {
      id: "ts_1",
      status: "active",
      conceptIds: ["c1"],
      questionCount: 2,
      correctCount: 0,
      partialCount: 0,
      wrongCount: 0,
      startedAt: Date.now(),
      completedAt: null
    },
    items: [
      {
        id: "tsi_1",
        sessionId: "ts_1",
        reviewItemId: "ri_1",
        position: 0,
        userAnswer: null,
        grade: null,
        feedback: null,
        gradedAt: null,
        createdAt: Date.now()
      },
      {
        id: "tsi_2",
        sessionId: "ts_1",
        reviewItemId: "ri_2",
        position: 1,
        userAnswer: null,
        grade: null,
        feedback: null,
        gradedAt: null,
        createdAt: Date.now()
      }
    ],
    questions: [
      {
        id: "ri_1",
        conceptId: "c1",
        type: "MECHANISM_TRACE",
        prompt: "Explain how gradient descent works.",
        answer: { keyPoints: ["compute gradients"], expectedFlow: "Forward -> Backward" },
        rubric: { explanation: "Check steps.", keyTerms: ["gradient"], scoringCriteria: "Cover steps." },
        status: "active",
        dueAt: Date.now(),
        ease: 2.5,
        interval: 0,
        reps: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: "ri_2",
        conceptId: "c1",
        type: "FAILURE_MODE",
        prompt: "What fails when learning rate is too high?",
        answer: { failureConditions: ["lr too high"], consequences: ["diverges"] },
        rubric: { explanation: "Check divergence.", keyTerms: ["diverge"], scoringCriteria: "Identify." },
        status: "active",
        dueAt: Date.now(),
        ease: 2.5,
        interval: 0,
        reps: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]
  }),
  postSubmitTrainingAnswer: vi.fn().mockResolvedValue({
    item: {
      id: "tsi_1",
      sessionId: "ts_1",
      reviewItemId: "ri_1",
      position: 0,
      userAnswer: "My answer",
      grade: "correct",
      feedback: "Good answer!",
      gradedAt: Date.now(),
      createdAt: Date.now()
    },
    followUp: null
  }),
  postCompleteTrainingSession: vi.fn().mockResolvedValue({
    session: {
      id: "ts_1",
      status: "completed",
      conceptIds: ["c1"],
      questionCount: 2,
      correctCount: 2,
      partialCount: 0,
      wrongCount: 0,
      startedAt: Date.now(),
      completedAt: Date.now()
    }
  })
}));

describe("TrainingPanel", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <TrainingPanel open={false} onClose={() => {}} graph={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the idle state when open", () => {
    render(
      <TrainingPanel open={true} onClose={() => {}} graph={null} />
    );
    expect(screen.getByTestId("training-panel")).toBeInTheDocument();
    expect(screen.getByText("Start Training")).toBeInTheDocument();
  });

  it("starts a training session when clicking Start Training", async () => {
    render(
      <TrainingPanel open={true} onClose={() => {}} graph={null} />
    );

    fireEvent.click(screen.getByText("Start Training"));

    await waitFor(() => {
      expect(screen.getByText("Explain how gradient descent works.")).toBeInTheDocument();
    });

    expect(screen.getByTestId("question-type-badge")).toHaveTextContent("Mechanism Trace");
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
  });

  it("submits an answer and shows feedback", async () => {
    render(
      <TrainingPanel open={true} onClose={() => {}} graph={null} />
    );

    fireEvent.click(screen.getByText("Start Training"));

    await waitFor(() => {
      expect(screen.getByTestId("training-answer-input")).toBeInTheDocument();
    });

    const textarea = screen.getByTestId("training-answer-input");
    fireEvent.change(textarea, { target: { value: "My answer about gradients" } });

    fireEvent.click(screen.getByTestId("training-submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("training-feedback")).toBeInTheDocument();
    });

    expect(screen.getByTestId("training-grade")).toHaveTextContent("Correct");
    expect(screen.getByText("Good answer!")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <TrainingPanel open={true} onClose={onClose} graph={null} />
    );

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
