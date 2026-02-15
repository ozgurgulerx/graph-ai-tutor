import { fileURLToPath } from "node:url";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "./index";
import { ensureSeedFromFile, seedFromFile } from "./seed";

function seedPathFromHere(): string {
  return fileURLToPath(new URL("../../../fixtures/seed.graph.json", import.meta.url));
}

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("@graph-ai-tutor/db (postgres)", () => {
  it("creates/reads/updates a concept", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const created = await db.concept.create({
        title: "Process supervision",
        l0: "Supervision that labels intermediate steps rather than only final outcomes.",
        l1: ["Step labels", "Denser signal"],
        module: "post-training"
      });

      await db.concept.update({
        id: created.id,
        l0: "Supervision that labels intermediate steps (process) rather than only outcomes."
      });

      const fetched = await db.concept.getById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe("Process supervision");
      expect(fetched?.l1).toEqual(["Step labels", "Denser signal"]);
      expect(fetched?.module).toBe("post-training");
    } finally {
      await db.close();
    }
  });

  it("enforces foreign keys for edges (concepts/chunks must exist)", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "Evidence chunk."
      });

      const a = await db.concept.create({ title: "A" });
      const b = await db.concept.create({ title: "B" });

      await expect(
        db.edge.create({
          fromConceptId: a.id,
          toConceptId: "concept_missing",
          type: "PREREQUISITE_OF",
          evidenceChunkIds: [chunk.id]
        })
      ).rejects.toThrow();

      await expect(
        db.edge.create({
          fromConceptId: a.id,
          toConceptId: b.id,
          type: "PREREQUISITE_OF",
          evidenceChunkIds: ["chunk_missing"]
        })
      ).rejects.toThrow();

      const noEvidence = await db.edge.create({
        fromConceptId: a.id,
        toConceptId: b.id,
        type: "PREREQUISITE_OF",
        evidenceChunkIds: []
      });
      expect(noEvidence.evidenceChunkIds).toEqual([]);

      const ok = await db.edge.create({
        fromConceptId: a.id,
        toConceptId: b.id,
        type: "PREREQUISITE_OF",
        evidenceChunkIds: [chunk.id]
      });
      expect(ok.evidenceChunkIds).toEqual([chunk.id]);
    } finally {
      await db.close();
    }
  });

  it("indexes chunks for search (FTS v1)", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      await db.chunk.create({
        sourceId: source.id,
        content: "KV cache stores keys and values during decoding."
      });

      const hits = await db.chunk.search("kv cache decoding", 10);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.snippet.toLowerCase()).toContain("kv cache");
    } finally {
      await db.close();
    }
  });

  it("supports changesets, changeset items, and review items with referential integrity", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const changeset = await db.changeset.create();
      await db.changesetItem.create({
        changesetId: changeset.id,
        entityType: "edge",
        action: "create",
        payload: { any: "json" }
      });

      await expect(
        db.changesetItem.create({
          changesetId: "changeset_missing",
          entityType: "concept",
          action: "create",
          payload: {}
        })
      ).rejects.toThrow();

      const concept = await db.concept.create({ title: "KV cache" });
      await db.reviewItem.create({
        conceptId: concept.id,
        type: "CLOZE",
        prompt: "KV cache stores ___ and ___ tensors.",
        answer: { blanks: ["K", "V"] },
        rubric: { note: "Keys and values" },
        status: "draft"
      });

      expect(await db.changeset.count()).toBe(1);
      expect(await db.changesetItem.count()).toBe(1);
      expect(await db.reviewItem.count()).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("cascades deletes (concept -> edge -> evidence)", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "Evidence chunk."
      });

      const a = await db.concept.create({ title: "A" });
      const b = await db.concept.create({ title: "B" });

      await db.edge.create({
        fromConceptId: a.id,
        toConceptId: b.id,
        type: "PREREQUISITE_OF",
        evidenceChunkIds: [chunk.id]
      });

      expect(await db.edge.count()).toBe(1);
      await db.concept.delete(a.id);
      expect(await db.edge.count()).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("loads the seed graph fixture (and is idempotent via ensureSeedFromFile)", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const seedPath = seedPathFromHere();

      expect(await ensureSeedFromFile(db, seedPath)).toBe(true);
      expect(await ensureSeedFromFile(db, seedPath)).toBe(false);

      expect(await db.concept.count()).toBeGreaterThan(0);
      expect(await db.source.count()).toBeGreaterThan(0);
      expect(await db.chunk.count()).toBeGreaterThan(0);
      expect(await db.edge.count()).toBeGreaterThan(0);

      const kv = await db.concept.getById("concept_kv_cache");
      expect(kv?.title).toBe("KV cache");

      await expect(seedFromFile(db, seedPath)).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
