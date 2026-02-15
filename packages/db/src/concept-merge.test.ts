import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "./index";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("@graph-ai-tutor/db concept merge", () => {
  it("rewires edges, updates review items, creates aliases, and can undo", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const canonical = await db.concept.create({ id: "concept_a", title: "A" });
      const duplicate = await db.concept.create({ id: "concept_b", title: "B" });
      const other = await db.concept.create({ id: "concept_c", title: "C" });

      const source = await db.source.create({ id: "source_1", url: "https://example.com/1" });
      await db.conceptSource.attach(duplicate.id, source.id);

      const chunkSource = await db.source.create({ id: "source_chunks", url: "seed://chunks" });
      const chunk = await db.chunk.create({
        id: "chunk_1",
        sourceId: chunkSource.id,
        content: "Evidence."
      });

      await db.edge.create({
        id: "edge_b_to_c",
        fromConceptId: duplicate.id,
        toConceptId: other.id,
        type: "USED_IN",
        evidenceChunkIds: [chunk.id]
      });
      await db.edge.create({
        id: "edge_c_to_b",
        fromConceptId: other.id,
        toConceptId: duplicate.id,
        type: "USED_IN",
        evidenceChunkIds: [chunk.id]
      });

      // These become self-loops after merging B -> A.
      await db.edge.create({
        id: "edge_a_to_b",
        fromConceptId: canonical.id,
        toConceptId: duplicate.id,
        type: "PART_OF",
        evidenceChunkIds: [chunk.id]
      });
      await db.edge.create({
        id: "edge_b_to_a",
        fromConceptId: duplicate.id,
        toConceptId: canonical.id,
        type: "PART_OF",
        evidenceChunkIds: [chunk.id]
      });

      await db.reviewItem.create({
        id: "review_b",
        conceptId: duplicate.id,
        type: "CLOZE",
        prompt: "B is ___.",
        answer: { blanks: ["beta"] },
        rubric: { explanation: "B is beta." },
        status: "draft"
      });

      const merge = await db.conceptMerge.apply({
        canonicalId: canonical.id,
        duplicateIds: [duplicate.id]
      });

      expect(merge.id).toMatch(/^concept_merge_/);
      expect(merge.canonicalId).toBe(canonical.id);
      expect(merge.duplicateIds).toEqual([duplicate.id]);

      expect(await db.concept.getById(duplicate.id)).toBeNull();
      expect(await db.conceptAlias.getCanonicalId(duplicate.id)).toBe(canonical.id);

      const rewired1 = await db.edge.getById("edge_b_to_c");
      expect(rewired1?.fromConceptId).toBe(canonical.id);
      expect(rewired1?.toConceptId).toBe(other.id);
      expect(rewired1?.evidenceChunkIds).toEqual([chunk.id]);

      const rewired2 = await db.edge.getById("edge_c_to_b");
      expect(rewired2?.fromConceptId).toBe(other.id);
      expect(rewired2?.toConceptId).toBe(canonical.id);
      expect(rewired2?.evidenceChunkIds).toEqual([chunk.id]);

      expect(await db.edge.getById("edge_a_to_b")).toBeNull();
      expect(await db.edge.getById("edge_b_to_a")).toBeNull();

      const updatedReview = await db.reviewItem.getById("review_b");
      expect(updatedReview?.conceptId).toBe(canonical.id);

      const canonicalSources = await db.conceptSource.listSources(canonical.id);
      expect(canonicalSources.map((s) => s.id)).toEqual([source.id]);

      const undone = await db.conceptMerge.undo(merge.id);
      expect(undone.undoneAt).not.toBeNull();

      expect(await db.conceptAlias.getCanonicalId(duplicate.id)).toBeNull();
      expect(await db.concept.getById(duplicate.id)).not.toBeNull();

      const restored1 = await db.edge.getById("edge_b_to_c");
      expect(restored1?.fromConceptId).toBe(duplicate.id);
      expect(restored1?.toConceptId).toBe(other.id);
      expect(restored1?.evidenceChunkIds).toEqual([chunk.id]);

      const restored2 = await db.edge.getById("edge_c_to_b");
      expect(restored2?.fromConceptId).toBe(other.id);
      expect(restored2?.toConceptId).toBe(duplicate.id);
      expect(restored2?.evidenceChunkIds).toEqual([chunk.id]);

      const restored3 = await db.edge.getById("edge_a_to_b");
      expect(restored3?.fromConceptId).toBe(canonical.id);
      expect(restored3?.toConceptId).toBe(duplicate.id);
      expect(restored3?.evidenceChunkIds).toEqual([chunk.id]);

      const restored4 = await db.edge.getById("edge_b_to_a");
      expect(restored4?.fromConceptId).toBe(duplicate.id);
      expect(restored4?.toConceptId).toBe(canonical.id);
      expect(restored4?.evidenceChunkIds).toEqual([chunk.id]);

      const revertedReview = await db.reviewItem.getById("review_b");
      expect(revertedReview?.conceptId).toBe(duplicate.id);

      const sourcesAfterUndo = await db.conceptSource.listSources(duplicate.id);
      expect(sourcesAfterUndo.map((s) => s.id)).toEqual([source.id]);

      const canonicalSourcesAfterUndo = await db.conceptSource.listSources(canonical.id);
      expect(canonicalSourcesAfterUndo).toEqual([]);
    } finally {
      await db.close();
    }
  });
});

