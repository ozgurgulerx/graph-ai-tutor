import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "@graph-ai-tutor/db";
import {
  ApiErrorSchema,
  GetConceptResponseSchema,
  GraphResponseSchema,
  HealthResponseSchema,
  PostConceptResponseSchema,
  PostEdgeResponseSchema,
  SearchResponseSchema
} from "@graph-ai-tutor/shared";

import { buildServer } from "./server";

function json(res: { body: string }) {
  return JSON.parse(res.body) as unknown;
}

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

async function createTestApp() {
  const db = await openDb({ pool: createMemPool() });
  const app = buildServer({ repos: db });
  return { app, db };
}

describe("API v1", () => {
  it("GET /health returns ok: true", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(HealthResponseSchema.parse(json(res))).toEqual({ ok: true });
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /graph returns nodes + edges (empty)", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({ method: "GET", url: "/graph" });
      expect(res.statusCode).toBe(200);
      expect(GraphResponseSchema.parse(json(res))).toEqual({ nodes: [], edges: [] });
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /concept/:id returns 404 when missing", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({ method: "GET", url: "/concept/concept_missing" });
      expect(res.statusCode).toBe(404);
      const parsed = ApiErrorSchema.parse(json(res));
      expect(parsed.error.code).toBe("NOT_FOUND");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept creates and GET /concept/:id fetches", async () => {
    const { app, db } = await createTestApp();
    try {
      const createRes = await app.inject({
        method: "POST",
        url: "/concept",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "KV cache",
          l0: "Keys/values cached during decoding.",
          l1: ["Speeds up decoding"],
          module: "inference"
        })
      });
      expect(createRes.statusCode).toBe(200);

      const created = PostConceptResponseSchema.parse(json(createRes));
      expect(created.concept.id).toMatch(/^concept_/);
      expect(created.concept.title).toBe("KV cache");

      const getRes = await app.inject({
        method: "GET",
        url: `/concept/${created.concept.id}`
      });
      expect(getRes.statusCode).toBe(200);
      const fetched = GetConceptResponseSchema.parse(json(getRes));
      expect(fetched.concept.title).toBe("KV cache");
      expect(fetched.concept.module).toBe("inference");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept updates an existing concept", async () => {
    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({ title: "Self-attention", l0: null, l1: [] });

      const res = await app.inject({
        method: "POST",
        url: "/concept",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          id: concept.id,
          l0: "Mixes token information via attention."
        })
      });
      expect(res.statusCode).toBe(200);
      const updated = PostConceptResponseSchema.parse(json(res));
      expect(updated.concept.id).toBe(concept.id);
      expect(updated.concept.l0).toBe("Mixes token information via attention.");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /edge creates an edge (requires evidenceChunkIds)", async () => {
    const { app, db } = await createTestApp();
    try {
      const a = await db.concept.create({ title: "A" });
      const b = await db.concept.create({ title: "B" });
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "Evidence chunk."
      });

      const res = await app.inject({
        method: "POST",
        url: "/edge",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          fromConceptId: a.id,
          toConceptId: b.id,
          type: "PREREQUISITE_OF",
          evidenceChunkIds: [chunk.id]
        })
      });
      expect(res.statusCode).toBe(200);
      const parsed = PostEdgeResponseSchema.parse(json(res));
      expect(parsed.edge.fromConceptId).toBe(a.id);
      expect(parsed.edge.toConceptId).toBe(b.id);
      expect(parsed.edge.type).toBe("PREREQUISITE_OF");
      expect(parsed.edge.evidenceChunkIds).toEqual([chunk.id]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /search returns results", async () => {
    const { app, db } = await createTestApp();
    try {
      await db.concept.create({ title: "KV cache", l0: null, l1: [], module: "inference" });
      await db.concept.create({
        title: "Attention",
        l0: null,
        l1: [],
        module: "architectures"
      });

      const empty = await app.inject({ method: "GET", url: "/search" });
      expect(empty.statusCode).toBe(200);
      expect(SearchResponseSchema.parse(json(empty))).toEqual({ results: [] });

      const res = await app.inject({ method: "GET", url: "/search?q=KV" });
      expect(res.statusCode).toBe(200);
      const parsed = SearchResponseSchema.parse(json(res));
      expect(parsed.results.map((r) => r.title)).toContain("KV cache");
    } finally {
      await app.close();
      await db.close();
    }
  });
});
