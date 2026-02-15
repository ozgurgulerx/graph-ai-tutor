import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "@graph-ai-tutor/db";

import { runTutorJob } from "./job";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("Tutor v1 (grounded Q/A)", () => {
  it("returns structured answer with citations + used subgraph ids", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source", title: "Seed" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "KV cache stores keys and values from previous tokens during decoding."
      });

      const kv = await db.concept.create({ title: "KV cache", module: "inference" });
      const attn = await db.concept.create({ title: "Self-attention", module: "architectures" });
      const edge = await db.edge.create({
        fromConceptId: attn.id,
        toConceptId: kv.id,
        type: "USED_IN",
        evidenceChunkIds: [chunk.id],
        sourceUrl: source.url
      });

      const llm = {
        answer: async () => ({
          answer_markdown: "KV cache caches key/value tensors to speed up decoding.",
          cited_chunk_ids: [chunk.id],
          used_concept_ids: [kv.id, attn.id],
          used_edge_ids: [edge.id]
        })
      };

      const res = await runTutorJob({ repos: db, llm, question: "What is KV cache?" });
      expect(res.result.cited_chunk_ids).toEqual([chunk.id]);
      expect(res.result.used_concept_ids.sort()).toEqual([attn.id, kv.id].sort());
      expect(res.result.used_edge_ids).toEqual([edge.id]);

      expect(res.citations).toHaveLength(1);
      expect(res.citations[0]?.id).toBe(chunk.id);
      expect(res.citations[0]?.sourceUrl).toBe(source.url);
    } finally {
      await db.close();
    }
  });

  it("rejects LLM outputs that cite missing chunk ids", async () => {
    const db = await openDb({ pool: createMemPool() });
    try {
      const source = await db.source.create({ url: "seed://test/source" });
      await db.chunk.create({
        sourceId: source.id,
        content: "Evidence."
      });

      const llm = {
        answer: async () => ({
          answer_markdown: "Nope",
          cited_chunk_ids: ["chunk_missing"],
          used_concept_ids: [],
          used_edge_ids: []
        })
      };

      await expect(runTutorJob({ repos: db, llm, question: "Explain decoding" })).rejects.toThrow(
        /unknown chunk id/i
      );
    } finally {
      await db.close();
    }
  });
});

