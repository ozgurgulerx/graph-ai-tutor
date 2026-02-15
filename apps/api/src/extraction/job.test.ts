import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "@graph-ai-tutor/db";

import { runExtractionJob } from "./job";
import { ExtractedConceptSchema, ExtractedEdgeSchema } from "./schema";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("Structured extraction (changeset-only)", () => {
  it("creates a changeset + items that reference evidence chunk ids", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      const chunkA = await db.chunk.create({
        sourceId: source.id,
        content: "Chunk A about transformers."
      });
      const chunkB = await db.chunk.create({
        sourceId: source.id,
        content: "Chunk B about KV cache."
      });

      const llm = {
        proposeCandidates: async () => ({
          concepts: [
            {
              id: "concept_extracted_a",
              title: "Transformer",
              l0: null,
              l1: [],
              module: null,
              evidenceChunkIds: [chunkA.id]
            },
            {
              id: "concept_extracted_b",
              title: "KV cache",
              l0: "Cached key/value tensors during decoding.",
              l1: ["Speeds up decoding"],
              module: "inference",
              evidenceChunkIds: [chunkB.id]
            }
          ],
          edges: [
            {
              fromConceptId: "concept_extracted_a",
              toConceptId: "concept_extracted_b",
              type: "USED_IN",
              sourceUrl: source.url,
              confidence: 0.7,
              verifierScore: null,
              evidenceChunkIds: [chunkA.id, chunkB.id]
            }
          ]
        })
      };

      const res = await runExtractionJob({
        repos: db,
        sourceId: source.id,
        llm
      });

      const changeset = await db.changeset.getById(res.changesetId);
      expect(changeset?.sourceId).toBe(source.id);
      expect(res.itemsCreated).toBe(3);

      const items = await db.changesetItem.listByChangesetId(res.changesetId);
      expect(items).toHaveLength(3);

      const conceptItems = items.filter((i) => i.entityType === "concept");
      const edgeItems = items.filter((i) => i.entityType === "edge");
      expect(conceptItems).toHaveLength(2);
      expect(edgeItems).toHaveLength(1);

      const parsedConcepts = conceptItems.map((i) => ExtractedConceptSchema.parse(i.payload));
      expect(parsedConcepts.map((c) => c.id).sort()).toEqual(
        ["concept_extracted_a", "concept_extracted_b"].sort()
      );
      expect(parsedConcepts.flatMap((c) => c.evidenceChunkIds)).toEqual([chunkA.id, chunkB.id]);

      const parsedEdge = ExtractedEdgeSchema.parse(edgeItems[0]?.payload);
      expect(parsedEdge.fromConceptId).toBe("concept_extracted_a");
      expect(parsedEdge.toConceptId).toBe("concept_extracted_b");
      expect(parsedEdge.evidenceChunkIds.sort()).toEqual([chunkA.id, chunkB.id].sort());
    } finally {
      await db.close();
    }
  });

  it("enforces strict schema validation (extra keys rejected)", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "Evidence."
      });

      const llm = {
        proposeCandidates: async () => ({
          concepts: [
            {
              id: "concept_extracted_a",
              title: "A",
              l0: null,
              l1: [],
              module: null,
              evidenceChunkIds: [chunk.id],
              extra: "nope"
            }
          ],
          edges: []
        })
      };

      await expect(
        runExtractionJob({
          repos: db,
          sourceId: source.id,
          llm
        })
      ).rejects.toThrow();

      expect(await db.changeset.count()).toBe(0);
      expect(await db.changesetItem.count()).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("rejects candidates that reference missing chunk ids as evidence", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      await db.chunk.create({
        sourceId: source.id,
        content: "Evidence."
      });

      const llm = {
        proposeCandidates: async () => ({
          concepts: [
            {
              id: "concept_extracted_a",
              title: "A",
              l0: null,
              l1: [],
              module: null,
              evidenceChunkIds: ["chunk_missing"]
            }
          ],
          edges: []
        })
      };

      await expect(
        runExtractionJob({
          repos: db,
          sourceId: source.id,
          llm
        })
      ).rejects.toThrow(/missing evidence chunk id/i);

      expect(await db.changeset.count()).toBe(0);
      expect(await db.changesetItem.count()).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("rejects self-loop edges and unknown concept ids", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "Evidence."
      });

      const selfLoopLlm = {
        proposeCandidates: async () => ({
          concepts: [
            {
              id: "concept_extracted_a",
              title: "A",
              l0: null,
              l1: [],
              module: null,
              evidenceChunkIds: [chunk.id]
            }
          ],
          edges: [
            {
              fromConceptId: "concept_extracted_a",
              toConceptId: "concept_extracted_a",
              type: "USED_IN",
              sourceUrl: source.url,
              confidence: 0.5,
              verifierScore: null,
              evidenceChunkIds: [chunk.id]
            }
          ]
        })
      };

      await expect(
        runExtractionJob({
          repos: db,
          sourceId: source.id,
          llm: selfLoopLlm
        })
      ).rejects.toThrow(/must differ|self-loop/i);

      const unknownConceptLlm = {
        proposeCandidates: async () => ({
          concepts: [
            {
              id: "concept_extracted_a",
              title: "A",
              l0: null,
              l1: [],
              module: null,
              evidenceChunkIds: [chunk.id]
            }
          ],
          edges: [
            {
              fromConceptId: "concept_extracted_a",
              toConceptId: "concept_missing",
              type: "USED_IN",
              sourceUrl: source.url,
              confidence: 0.5,
              verifierScore: null,
              evidenceChunkIds: [chunk.id]
            }
          ]
        })
      };

      await expect(
        runExtractionJob({
          repos: db,
          sourceId: source.id,
          llm: unknownConceptLlm
        })
      ).rejects.toThrow(/toConceptId not found/i);

      expect(await db.changeset.count()).toBe(0);
      expect(await db.changesetItem.count()).toBe(0);
    } finally {
      await db.close();
    }
  });
});

