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

  it("lists review items by concept id", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const conceptA = await db.concept.create({ title: "A" });
      const conceptB = await db.concept.create({ title: "B" });

      await db.reviewItem.create({
        id: "review_item_a1",
        conceptId: conceptA.id,
        type: "CLOZE",
        prompt: "A is ___.",
        answer: { blanks: ["alpha"] },
        rubric: { explanation: "A is alpha." },
        status: "draft"
      });

      await db.reviewItem.create({
        id: "review_item_b1",
        conceptId: conceptB.id,
        type: "CLOZE",
        prompt: "B is ___.",
        answer: { blanks: ["beta"] },
        rubric: { explanation: "B is beta." },
        status: "draft"
      });

      const itemsA = await db.reviewItem.listByConceptId(conceptA.id);
      expect(itemsA.map((i) => i.id)).toEqual(["review_item_a1"]);

      const itemsB = await db.reviewItem.listByConceptId(conceptB.id);
      expect(itemsB.map((i) => i.id)).toEqual(["review_item_b1"]);
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

  it("attaches sources to concepts (concept_source join)", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const concept = await db.concept.create({ title: "A" });
      const source = await db.source.create({ url: "https://example.com/docs", title: "Docs" });

      await db.conceptSource.attach(concept.id, source.id);
      expect(await db.conceptSource.count()).toBe(1);

      const sources = await db.conceptSource.listSources(concept.id);
      expect(sources.map((s) => s.url)).toEqual(["https://example.com/docs"]);

      await db.concept.delete(concept.id);
      expect(await db.conceptSource.count()).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("getNeighborhoodIds returns BFS neighborhood at given depth", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      // A -> B -> C -> D (chain)
      const a = await db.concept.create({ id: "concept_a", title: "A" });
      const b = await db.concept.create({ id: "concept_b", title: "B" });
      const c = await db.concept.create({ id: "concept_c", title: "C" });
      await db.concept.create({ id: "concept_d", title: "D" });

      await db.edge.create({
        fromConceptId: a.id,
        toConceptId: b.id,
        type: "PREREQUISITE_OF"
      });
      await db.edge.create({
        fromConceptId: b.id,
        toConceptId: c.id,
        type: "USED_IN"
      });
      await db.edge.create({
        fromConceptId: c.id,
        toConceptId: "concept_d",
        type: "PREREQUISITE_OF"
      });

      // Depth 0: only center
      const d0 = await db.concept.getNeighborhoodIds(b.id, 0);
      expect(d0).toEqual([b.id]);

      // Depth 1: center + immediate neighbors
      const d1 = await db.concept.getNeighborhoodIds(b.id, 1);
      expect(new Set(d1)).toEqual(new Set([a.id, b.id, c.id]));

      // Depth 2: reaches D as well
      const d2 = await db.concept.getNeighborhoodIds(b.id, 2);
      expect(new Set(d2)).toEqual(new Set([a.id, b.id, c.id, "concept_d"]));

      // With typeFilters: only follow PREREQUISITE_OF edges
      const filtered = await db.concept.getNeighborhoodIds(b.id, 2, ["PREREQUISITE_OF"]);
      // From B: only A->B is PREREQUISITE_OF, so reaches A at depth 1
      // From A: no outgoing PREREQUISITE_OF edges lead to new nodes (A->B already seen)
      // B->C is USED_IN so not followed
      expect(new Set(filtered)).toEqual(new Set([a.id, b.id]));
    } finally {
      await db.close();
    }
  });

  it("listSummariesGroupedByModule groups concepts by module", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      await db.concept.create({ title: "A", module: "mod1" });
      await db.concept.create({ title: "B", module: "mod1" });
      await db.concept.create({ title: "C", module: "mod2" });
      await db.concept.create({ title: "D", module: null });

      const groups = await db.concept.listSummariesGroupedByModule();

      const mod1 = groups.find((g) => g.module === "mod1");
      expect(mod1).toBeDefined();
      expect(mod1!.count).toBe(2);
      expect(mod1!.conceptIds).toHaveLength(2);

      const mod2 = groups.find((g) => g.module === "mod2");
      expect(mod2).toBeDefined();
      expect(mod2!.count).toBe(1);

      const uncat = groups.find((g) => g.module === "(uncategorized)");
      expect(uncat).toBeDefined();
      expect(uncat!.count).toBe(1);
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

      const kv = await db.concept.getById("genai.systems_inference.kvcache.kv_cache");
      expect(kv?.title).toBe("KV Cache");

      await expect(seedFromFile(db, seedPath)).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
