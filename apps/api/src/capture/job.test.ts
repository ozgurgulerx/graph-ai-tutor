import { newDb } from "pg-mem";
import { describe, expect, it, vi } from "vitest";

import { openDb } from "@graph-ai-tutor/db";

import type { CaptureLlm } from "./llm";
import { runCaptureJob } from "./job";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("runCaptureJob", () => {
  it("creates changeset from capture text", async () => {
    const db = await openDb({ pool: createMemPool() });

    await db.concept.create({ id: "concept_existing", title: "Existing" });

    const llm: CaptureLlm = {
      propose: vi.fn(async () => ({
        concepts: [
          {
            id: "concept_new_a",
            title: "New A",
            l0: "A description",
            l1: ["bullet1"],
            module: null,
            evidence: "user said they learned about A",
            confidence: 0.9
          }
        ],
        edges: [
          {
            fromConceptId: "concept_existing",
            toConceptId: "concept_new_a",
            type: "PREREQUISITE_OF",
            evidence: "A depends on existing",
            confidence: 0.8
          }
        ]
      }))
    };

    try {
      const result = await runCaptureJob({
        repos: db,
        llm,
        text: "I learned about A which depends on Existing"
      });

      expect(result.changesetId).toBeTruthy();
      expect(result.itemsCreated).toBe(2);
      expect(result.sourceId).toBeTruthy();

      const changeset = await db.changeset.getById(result.changesetId);
      expect(changeset).toBeTruthy();
      expect(changeset!.status).toBe("draft");

      const items = await db.changesetItem.listByChangesetId(result.changesetId);
      expect(items).toHaveLength(2);

      const conceptItem = items.find((i) => i.entityType === "concept");
      expect(conceptItem).toBeTruthy();
      expect(conceptItem!.action).toBe("create");

      const edgeItem = items.find((i) => i.entityType === "edge");
      expect(edgeItem).toBeTruthy();
      expect(edgeItem!.action).toBe("create");

      const source = await db.source.getById(result.sourceId);
      expect(source).toBeTruthy();
      expect(source!.url).toMatch(/^capture:\/\//);
    } finally {
      await db.close();
    }
  });

  it("rejects duplicate concept IDs", async () => {
    const db = await openDb({ pool: createMemPool() });

    const llm: CaptureLlm = {
      propose: vi.fn(async () => ({
        concepts: [
          {
            id: "concept_dup",
            title: "Dup 1",
            l0: null,
            l1: [],
            module: null,
            evidence: "evidence",
            confidence: 0.9
          },
          {
            id: "concept_dup",
            title: "Dup 2",
            l0: null,
            l1: [],
            module: null,
            evidence: "evidence",
            confidence: 0.9
          }
        ],
        edges: []
      }))
    };

    try {
      await expect(
        runCaptureJob({ repos: db, llm, text: "test" })
      ).rejects.toThrow("Duplicate concept id");
    } finally {
      await db.close();
    }
  });

  it("rejects self-loop edges", async () => {
    const db = await openDb({ pool: createMemPool() });

    const llm: CaptureLlm = {
      propose: vi.fn(async () => ({
        concepts: [
          {
            id: "concept_loop",
            title: "Loop",
            l0: null,
            l1: [],
            module: null,
            evidence: "evidence",
            confidence: 0.9
          }
        ],
        edges: [
          {
            fromConceptId: "concept_loop",
            toConceptId: "concept_loop",
            type: "PREREQUISITE_OF",
            evidence: "self ref",
            confidence: 0.5
          }
        ]
      }))
    };

    try {
      await expect(
        runCaptureJob({ repos: db, llm, text: "test" })
      ).rejects.toThrow(/fromConceptId and toConceptId must differ|Self-loop/);
    } finally {
      await db.close();
    }
  });

  it("rejects unknown edge endpoints", async () => {
    const db = await openDb({ pool: createMemPool() });

    const llm: CaptureLlm = {
      propose: vi.fn(async () => ({
        concepts: [
          {
            id: "concept_known",
            title: "Known",
            l0: null,
            l1: [],
            module: null,
            evidence: "evidence",
            confidence: 0.9
          }
        ],
        edges: [
          {
            fromConceptId: "concept_known",
            toConceptId: "concept_unknown",
            type: "PREREQUISITE_OF",
            evidence: "edge to unknown",
            confidence: 0.5
          }
        ]
      }))
    };

    try {
      await expect(
        runCaptureJob({ repos: db, llm, text: "test" })
      ).rejects.toThrow("toConceptId not found");
    } finally {
      await db.close();
    }
  });
});
