import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "./index";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("trainingSession repository", () => {
  it("creates and retrieves a training session", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1", "c2"],
        questionCount: 4
      });

      expect(session.id).toMatch(/^ts_/);
      expect(session.status).toBe("active");
      expect(session.conceptIds).toEqual(["c1", "c2"]);
      expect(session.questionCount).toBe(4);
      expect(session.correctCount).toBe(0);
      expect(session.completedAt).toBeNull();

      const fetched = await db.trainingSession.getById(session.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(session.id);
      expect(fetched!.status).toBe("active");
    } finally {
      await db.close();
    }
  });

  it("completes a training session", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1"],
        questionCount: 2
      });

      const completed = await db.trainingSession.complete(session.id);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeTypeOf("number");
    } finally {
      await db.close();
    }
  });

  it("abandons a training session", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1"],
        questionCount: 2
      });

      const abandoned = await db.trainingSession.abandon(session.id);
      expect(abandoned.status).toBe("abandoned");
      expect(abandoned.completedAt).toBeTypeOf("number");
    } finally {
      await db.close();
    }
  });

  it("updates session counts", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1"],
        questionCount: 3
      });

      await db.trainingSession.updateCounts(session.id, {
        correctCount: 1,
        partialCount: 1,
        wrongCount: 1
      });

      const fetched = await db.trainingSession.getById(session.id);
      expect(fetched!.correctCount).toBe(1);
      expect(fetched!.partialCount).toBe(1);
      expect(fetched!.wrongCount).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("returns null for non-existent session", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const fetched = await db.trainingSession.getById("ts_nonexistent");
      expect(fetched).toBeNull();
    } finally {
      await db.close();
    }
  });
});

describe("trainingSessionItem repository", () => {
  it("creates and retrieves session items", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1"],
        questionCount: 2
      });

      // Create a concept and review item first
      const concept = await db.concept.create({ title: "Test Concept" });
      await db.reviewItem.create({
        id: "ri_1",
        conceptId: concept.id,
        type: "MECHANISM_TRACE",
        prompt: "Explain how X works",
        answer: { keyPoints: ["step1"], expectedFlow: "flow" },
        rubric: { explanation: "Check steps" },
        status: "active",
        dueAt: Date.now()
      });

      const item = await db.trainingSessionItem.create({
        sessionId: session.id,
        reviewItemId: "ri_1",
        position: 0
      });

      expect(item.id).toMatch(/^tsi_/);
      expect(item.sessionId).toBe(session.id);
      expect(item.reviewItemId).toBe("ri_1");
      expect(item.position).toBe(0);
      expect(item.userAnswer).toBeNull();
      expect(item.grade).toBeNull();
      expect(item.feedback).toBeNull();

      const fetched = await db.trainingSessionItem.getById(item.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(item.id);

      const listed = await db.trainingSessionItem.listBySessionId(session.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]!.id).toBe(item.id);
    } finally {
      await db.close();
    }
  });

  it("submits an answer for a session item", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const session = await db.trainingSession.create({
        conceptIds: ["c1"],
        questionCount: 1
      });

      const concept = await db.concept.create({ title: "Test" });
      await db.reviewItem.create({
        id: "ri_2",
        conceptId: concept.id,
        type: "FAILURE_MODE",
        prompt: "What fails?",
        answer: { failureConditions: ["cond"], consequences: ["result"] },
        rubric: { explanation: "Check failure conditions" },
        status: "active",
        dueAt: Date.now()
      });

      const item = await db.trainingSessionItem.create({
        sessionId: session.id,
        reviewItemId: "ri_2",
        position: 0
      });

      const submitted = await db.trainingSessionItem.submitAnswer({
        id: item.id,
        userAnswer: "The system fails when...",
        grade: "partial",
        feedback: "Good start but missing some points."
      });

      expect(submitted.userAnswer).toBe("The system fails when...");
      expect(submitted.grade).toBe("partial");
      expect(submitted.feedback).toBe("Good start but missing some points.");
      expect(submitted.gradedAt).toBeTypeOf("number");
    } finally {
      await db.close();
    }
  });
});
