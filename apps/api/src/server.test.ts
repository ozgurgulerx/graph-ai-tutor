import { newDb } from "pg-mem";
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { openDb } from "@graph-ai-tutor/db";
import {
  ApiErrorSchema,
  GetConceptResponseSchema,
  GetConceptQuizzesResponseSchema,
  GetConceptSourcesResponseSchema,
  GetEdgeEvidenceResponseSchema,
  GetChangesetResponseSchema,
  GetChangesetsResponseSchema,
  GetConceptDraftRevisionsResponseSchema,
  GetReviewDueResponseSchema,
  GraphClusteredResponseSchema,
  GraphResponseSchema,
  HealthResponseSchema,
  PostApplyChangesetResponseSchema,
  PostChangesetItemStatusResponseSchema,
  PostConceptResponseSchema,
  PostConceptDistillResponseSchema,
  PostConceptSourceResponseSchema,
  PostConceptLocalSourceResponseSchema,
  GetSourceContentResponseSchema,
  PostSourceContentResponseSchema,
  PostCrawlResponseSchema,
  PostDraftRevisionApplyResponseSchema,
  PostDraftRevisionRevertResponseSchema,
  PostEdgeResponseSchema,
  PostGenerateConceptQuizzesResponseSchema,
  PostConceptMergePreviewResponseSchema,
  PostConceptMergeApplyResponseSchema,
  PostConceptMergeUndoResponseSchema,
  GetConceptMergesResponseSchema,
  PostReviewGradeResponseSchema,
  PostTutorResponseSchema,
  PostCaptureResponseSchema,
  PostContextPackResponseSchema,
  PostCreateTrainingSessionResponseSchema,
  GetTrainingSessionResponseSchema,
  PostSubmitTrainingAnswerResponseSchema,
  PostCompleteTrainingSessionResponseSchema,
  SearchExactResponseSchema,
  SearchResponseSchema,
  SearchUniversalResponseSchema
} from "@graph-ai-tutor/shared";

import type { CaptureLlm } from "./capture";
import { createTestDistillLlm } from "./distill";
import type { ExtractionLlm } from "./extraction";
import type { TrainingLlm } from "./training";
import { buildServer } from "./server";
import { resolveVaultUrlToPath } from "./vault";

function json(res: { body: string }) {
  return JSON.parse(res.body) as unknown;
}

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

function createMockTrainingLlm(): TrainingLlm {
  return {
    async proposeDraft() {
      return {
        items: [
          {
            type: "MECHANISM_TRACE",
            prompt: "Explain step-by-step how gradient descent works.",
            answer: {
              keyPoints: ["compute gradients", "update weights"],
              expectedFlow: "Forward -> Backward -> Update"
            }
          },
          {
            type: "FAILURE_MODE",
            prompt: "What happens when learning rate is too high?",
            answer: {
              failureConditions: ["learning rate too large"],
              consequences: ["loss diverges"]
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
              keyPoints: ["compute gradients", "update weights"],
              expectedFlow: "Forward -> Backward -> Update"
            },
            rubric: {
              explanation: "Check key steps.",
              keyTerms: ["gradient", "loss"],
              scoringCriteria: "Correct if mentions steps."
            }
          },
          {
            type: "FAILURE_MODE",
            prompt: "What happens when learning rate is too high?",
            answer: {
              failureConditions: ["learning rate too large"],
              consequences: ["loss diverges"]
            },
            rubric: {
              explanation: "Check divergence.",
              keyTerms: ["diverge"],
              scoringCriteria: "Correct if identifies instability."
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

async function createTestApp(
  options: {
    extractionLlm?: ExtractionLlm;
    captureLlm?: CaptureLlm;
    trainingLlm?: TrainingLlm;
    vaultRoot?: string;
  } = {}
) {
  const db = await openDb({ pool: createMemPool() });
  const app = buildServer({
    repos: db,
    distillLlm: createTestDistillLlm(),
    extractionLlm: options.extractionLlm,
    captureLlm: options.captureLlm,
    trainingLlm: options.trainingLlm,
    vaultRoot: options.vaultRoot
  });
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
      const res = await app.inject({ method: "GET", url: "/api/graph" });
      expect(res.statusCode).toBe(200);
      expect(GraphResponseSchema.parse(json(res))).toEqual({ nodes: [], edges: [] });
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /graph supports center/depth and typeFilters", async () => {
    const { app, db } = await createTestApp();
    try {
      const a = await db.concept.create({ id: "concept_a", title: "A" });
      const b = await db.concept.create({ id: "concept_b", title: "B" });
      const c = await db.concept.create({ id: "concept_c", title: "C" });

      await db.edge.create({ id: "edge_a_b", fromConceptId: a.id, toConceptId: b.id, type: "PREREQUISITE_OF" });
      await db.edge.create({ id: "edge_b_c", fromConceptId: b.id, toConceptId: c.id, type: "USED_IN" });

      const depth0 = await app.inject({ method: "GET", url: `/api/graph?center=${b.id}&depth=0` });
      expect(depth0.statusCode).toBe(200);
      const parsed0 = GraphResponseSchema.parse(json(depth0));
      expect(parsed0.nodes.map((n) => n.id)).toEqual([b.id]);
      expect(parsed0.edges).toEqual([]);

      const depth1 = await app.inject({ method: "GET", url: `/api/graph?center=${b.id}&depth=1` });
      expect(depth1.statusCode).toBe(200);
      const parsed1 = GraphResponseSchema.parse(json(depth1));
      expect(new Set(parsed1.nodes.map((n) => n.id))).toEqual(new Set([a.id, b.id, c.id]));
      expect(new Set(parsed1.edges.map((e) => e.id))).toEqual(new Set(["edge_a_b", "edge_b_c"]));

      const filtered = await app.inject({
        method: "GET",
        url: `/api/graph?center=${b.id}&depth=1&typeFilters=PREREQUISITE_OF`
      });
      expect(filtered.statusCode).toBe(200);
      const parsedFiltered = GraphResponseSchema.parse(json(filtered));
      expect(new Set(parsedFiltered.nodes.map((n) => n.id))).toEqual(new Set([a.id, b.id]));
      expect(parsedFiltered.edges.map((e) => e.id)).toEqual(["edge_a_b"]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /graph/clustered returns clusters grouped by module", async () => {
    const { app, db } = await createTestApp();
    try {
      await db.concept.create({ id: "concept_a", title: "A", module: "mod1" });
      await db.concept.create({ id: "concept_b", title: "B", module: "mod1" });
      await db.concept.create({ id: "concept_c", title: "C", module: "mod2" });
      await db.concept.create({ id: "concept_d", title: "D", module: null });

      await db.edge.create({
        id: "edge_a_c",
        fromConceptId: "concept_a",
        toConceptId: "concept_c",
        type: "PREREQUISITE_OF"
      });

      const res = await app.inject({ method: "GET", url: "/api/graph/clustered" });
      expect(res.statusCode).toBe(200);
      const parsed = GraphClusteredResponseSchema.parse(json(res));

      expect(parsed.clusters.map((c) => c.module).sort()).toEqual(["mod1", "mod2"]);

      const mod1 = parsed.clusters.find((c) => c.module === "mod1");
      expect(mod1?.count).toBe(2);
      expect(new Set(mod1?.conceptIds)).toEqual(new Set(["concept_a", "concept_b"]));

      const mod2 = parsed.clusters.find((c) => c.module === "mod2");
      expect(mod2?.count).toBe(1);
      expect(mod2?.conceptIds).toEqual(["concept_c"]);

      expect(parsed.interClusterEdges).toHaveLength(1);
      expect(parsed.interClusterEdges[0]?.id).toBe("edge_a_c");

      expect(parsed.unclustered.map((u) => u.id)).toEqual(["concept_d"]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /node/:id aliases the concept payload", async () => {
    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({ id: "concept_node", title: "Node" });
      const res = await app.inject({ method: "GET", url: `/api/node/${concept.id}` });
      expect(res.statusCode).toBe(200);
      const parsed = GetConceptResponseSchema.parse(json(res));
      expect(parsed.concept.id).toBe(concept.id);
      expect(parsed.concept.title).toBe("Node");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /concept/:id returns 404 when missing", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({ method: "GET", url: "/api/concept/concept_missing" });
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
        url: "/api/concept",
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
        url: `/api/concept/${created.concept.id}`
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
        url: "/api/concept",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          id: concept.id,
          l0: "Mixes token information via attention.",
          l1: ["QKV projections", "Softmax attention"]
        })
      });
      expect(res.statusCode).toBe(200);
      const updated = PostConceptResponseSchema.parse(json(res));
      expect(updated.concept.id).toBe(concept.id);
      expect(updated.concept.l0).toBe("Mixes token information via attention.");
      expect(updated.concept.l1).toEqual(["QKV projections", "Softmax attention"]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept/:id/source attaches a source and GET /concept/:id/sources lists it", async () => {
    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({ title: "A" });

      const attachRes = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/source`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          url: "https://example.com/docs",
          title: "Example docs"
        })
      });
      expect(attachRes.statusCode).toBe(200);
      const attached = PostConceptSourceResponseSchema.parse(json(attachRes));
      expect(attached.source.id).toMatch(/^source_/);
      expect(attached.source.url).toBe("https://example.com/docs");
      expect(attached.source.title).toBe("Example docs");

      const listRes = await app.inject({
        method: "GET",
        url: `/api/concept/${concept.id}/sources`
      });
      expect(listRes.statusCode).toBe(200);
      const listed = GetConceptSourcesResponseSchema.parse(json(listRes));
      expect(listed.sources.map((s) => s.url)).toEqual(["https://example.com/docs"]);

      const attachAgain = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/source`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          url: "https://example.com/docs",
          title: "Example docs"
        })
      });
      expect(attachAgain.statusCode).toBe(200);

      const listAgain = await app.inject({
        method: "GET",
        url: `/api/concept/${concept.id}/sources`
      });
      expect(listAgain.statusCode).toBe(200);
      const listedAgain = GetConceptSourcesResponseSchema.parse(json(listAgain));
      expect(listedAgain.sources.map((s) => s.url)).toEqual(["https://example.com/docs"]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept/:id/source/local creates a vault source and attaches it", async () => {
    const prev = process.env.GRAPH_AI_TUTOR_VAULT_DIR;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graph-ai-tutor-vault-"));
    process.env.GRAPH_AI_TUTOR_VAULT_DIR = dir;

    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({ title: "KV cache" });

      const res = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/source/local`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({})
      });
      expect(res.statusCode).toBe(200);
      const created = PostConceptLocalSourceResponseSchema.parse(json(res));
      expect(created.source.url.startsWith("vault://sources/")).toBe(true);

      const listRes = await app.inject({
        method: "GET",
        url: `/api/concept/${concept.id}/sources`
      });
      expect(listRes.statusCode).toBe(200);
      const listed = GetConceptSourcesResponseSchema.parse(json(listRes));
      expect(listed.sources.map((s) => s.id)).toContain(created.source.id);

      const abs = resolveVaultUrlToPath(created.source.url).absPath;
      const content = await fs.readFile(abs, "utf8");
      expect(content).toMatch(/^#\\s+KV cache notes/m);
    } finally {
      await app.close();
      await db.close();
      await fs.rm(dir, { recursive: true, force: true });
      if (typeof prev === "undefined") delete process.env.GRAPH_AI_TUTOR_VAULT_DIR;
      else process.env.GRAPH_AI_TUTOR_VAULT_DIR = prev;
    }
  });

  it("GET/POST /source/:id/content reads/writes vault content and reindexes chunks", async () => {
    const prev = process.env.GRAPH_AI_TUTOR_VAULT_DIR;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graph-ai-tutor-vault-"));
    process.env.GRAPH_AI_TUTOR_VAULT_DIR = dir;

    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({ title: "A" });

      const createRes = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/source/local`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ title: "A notes" })
      });
      expect(createRes.statusCode).toBe(200);
      const created = PostConceptLocalSourceResponseSchema.parse(json(createRes));

      const getRes = await app.inject({
        method: "GET",
        url: `/api/source/${created.source.id}/content`
      });
      expect(getRes.statusCode).toBe(200);
      const fetched = GetSourceContentResponseSchema.parse(json(getRes));
      expect(fetched.content).toMatch(/^#\\s+A notes/m);

      const nextContent = [
        "# New title",
        "",
        "Some paragraph.",
        "",
        "```ts",
        "console.log('hi')",
        "```",
        ""
      ].join("\\n");

      const saveRes = await app.inject({
        method: "POST",
        url: `/api/source/${created.source.id}/content`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ content: nextContent })
      });
      expect(saveRes.statusCode).toBe(200);
      const saved = PostSourceContentResponseSchema.parse(json(saveRes));
      expect(saved.source.title).toBe("New title");
      expect(saved.chunkCount).toBeGreaterThan(0);

      const getRes2 = await app.inject({
        method: "GET",
        url: `/api/source/${created.source.id}/content`
      });
      expect(getRes2.statusCode).toBe(200);
      const fetched2 = GetSourceContentResponseSchema.parse(json(getRes2));
      expect(fetched2.content).toBe(nextContent);

      const chunks = await db.chunk.listBySourceId(created.source.id);
      expect(chunks.length).toBeGreaterThan(0);

      const listRes = await app.inject({
        method: "GET",
        url: `/api/concept/${concept.id}/sources`
      });
      const listed = GetConceptSourcesResponseSchema.parse(json(listRes));
      expect(listed.sources.find((s) => s.id === created.source.id)?.title).toBe("New title");
    } finally {
      await app.close();
      await db.close();
      await fs.rm(dir, { recursive: true, force: true });
      if (typeof prev === "undefined") delete process.env.GRAPH_AI_TUTOR_VAULT_DIR;
      else process.env.GRAPH_AI_TUTOR_VAULT_DIR = prev;
    }
  });

  it("distills L1/L2 into a draft revision, applies it, and can revert", async () => {
    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({
        title: "KV cache",
        l0: "Keys/values cached during decoding.",
        l1: ["Speeds up decoding"],
        l2: []
      });
      const other = await db.concept.create({ title: "Self-attention" });
      const source = await db.source.create({ url: "seed://test/source" });
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "During autoregressive decoding, keys and values are cached."
      });
      await db.edge.create({
        fromConceptId: other.id,
        toConceptId: concept.id,
        type: "USED_IN",
        evidenceChunkIds: [chunk.id]
      });

      const distillRes = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/distill`
      });
      expect(distillRes.statusCode).toBe(200);
      const distilled = PostConceptDistillResponseSchema.parse(json(distillRes));
      expect(distilled.revision.status).toBe("draft");
      expect(distilled.revision.diff).toContain("+++ L1 (after)");
      expect(distilled.revision.before.l1).toEqual(["Speeds up decoding"]);

      const applyRes = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/draft-revisions/${distilled.revision.id}/apply`
      });
      expect(applyRes.statusCode).toBe(200);
      const applied = PostDraftRevisionApplyResponseSchema.parse(json(applyRes));
      expect(applied.revision.status).toBe("applied");
      expect(applied.concept.l0).toBe("Keys/values cached during decoding.");
      expect(applied.concept.l1).toEqual(distilled.revision.after.l1);
      expect(applied.concept.l2).toEqual(distilled.revision.after.l2);

      const listRes = await app.inject({
        method: "GET",
        url: `/api/concept/${concept.id}/draft-revisions`
      });
      expect(listRes.statusCode).toBe(200);
      const listed = GetConceptDraftRevisionsResponseSchema.parse(json(listRes));
      expect(listed.revisions.length).toBeGreaterThanOrEqual(1);

      const revertRes = await app.inject({
        method: "POST",
        url: `/api/concept/${concept.id}/draft-revisions/${distilled.revision.id}/revert`
      });
      expect(revertRes.statusCode).toBe(200);
      const reverted = PostDraftRevisionRevertResponseSchema.parse(json(revertRes));
      expect(reverted.revision.kind).toBe("revert");
      expect(reverted.revision.status).toBe("applied");
      expect(reverted.concept.l1).toEqual(["Speeds up decoding"]);
      expect(reverted.concept.l2).toEqual([]);
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
        url: "/api/edge",
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

  it("GET /edge/:id/evidence returns chunk text + source metadata", async () => {
    const { app, db } = await createTestApp();
    try {
      const a = await db.concept.create({ title: "A" });
      const b = await db.concept.create({ title: "B" });
      const source = await db.source.create({ url: "https://example.com/source", title: "Src" });
      const chunk = await db.chunk.create({ sourceId: source.id, content: "Evidence chunk." });
      const edge = await db.edge.create({
        fromConceptId: a.id,
        toConceptId: b.id,
        type: "PREREQUISITE_OF",
        evidenceChunkIds: [chunk.id]
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/edge/${edge.id}/evidence`
      });
      expect(res.statusCode).toBe(200);
      const parsed = GetEdgeEvidenceResponseSchema.parse(json(res));
      expect(parsed.edge.id).toBe(edge.id);
      expect(parsed.evidence).toHaveLength(1);
      expect(parsed.evidence[0]?.chunk.id).toBe(chunk.id);
      expect(parsed.evidence[0]?.chunk.content).toBe("Evidence chunk.");
      expect(parsed.evidence[0]?.source.url).toBe("https://example.com/source");
      expect(parsed.evidence[0]?.source.title).toBe("Src");
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

      const empty = await app.inject({ method: "GET", url: "/api/search" });
      expect(empty.statusCode).toBe(200);
      expect(SearchResponseSchema.parse(json(empty))).toEqual({ results: [] });

      const res = await app.inject({ method: "GET", url: "/api/search?q=KV" });
      expect(res.statusCode).toBe(200);
      const parsed = SearchResponseSchema.parse(json(res));
      expect(parsed.results.map((r) => r.title)).toContain("KV cache");

      const exactRes = await app.inject({ method: "GET", url: "/api/search?q=cache&mode=exact" });
      expect(exactRes.statusCode).toBe(200);
      const exact = SearchExactResponseSchema.parse(json(exactRes));
      expect(exact.results.map((r) => r.id).length).toBeGreaterThan(0);
      expect(exact.results[0]?.titleHighlight ?? "").toContain("<mark>");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /search/universal returns concepts + sources + evidence", async () => {
    const { app, db } = await createTestApp();
    try {
      const rag = await db.concept.create({
        title: "Retrieval-Augmented Generation (RAG)",
        l0: "RAG retrieves documents and then generates an answer.",
        l1: [],
        module: "knowledge_memory"
      });
      const source = await db.source.create({
        url: "https://example.com/graphrag",
        title: "GraphRAG"
      });
      await db.conceptSource.attach(rag.id, source.id);
      const chunk = await db.chunk.create({
        sourceId: source.id,
        content: "GraphRAG is a RAG technique that uses graphs for retrieval."
      });

      const res = await app.inject({ method: "GET", url: "/api/search/universal?q=RAG" });
      expect(res.statusCode).toBe(200);
      const parsed = SearchUniversalResponseSchema.parse(json(res));

      expect(parsed.concepts.map((c) => c.id)).toContain(rag.id);

      const src = parsed.sources.find((s) => s.source.id === source.id);
      expect(src?.conceptIds).toContain(rag.id);
      expect(src?.titleHighlight ?? "").toContain("<mark>");

      const ev = parsed.evidence.find((e) => e.chunk.id === chunk.id);
      expect(ev?.conceptIds).toContain(rag.id);
      expect(ev?.snippetHighlight ?? "").toContain("<mark>");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("Changeset inbox flow: list, inspect, accept items, apply accepted, graph updates", async () => {
    const { app, db } = await createTestApp();
    try {
      const from = await db.concept.create({ id: "concept_from", title: "From" });
      const source = await db.source.create({ id: "source_1", url: "seed://source" });
      const chunk = await db.chunk.create({
        id: "chunk_1",
        sourceId: source.id,
        content: "Chunk evidence."
      });

      const changeset = await db.changeset.create({ id: "changeset_1" });
      await db.changesetItem.create({
        id: "changeset_item_concept",
        changesetId: changeset.id,
        entityType: "concept",
        action: "create",
        status: "pending",
        payload: {
          id: "concept_new",
          title: "New concept",
          l0: null,
          l1: [],
          module: null
        }
      });
      await db.changesetItem.create({
        id: "changeset_item_edge",
        changesetId: changeset.id,
        entityType: "edge",
        action: "create",
        status: "pending",
        payload: {
          fromConceptId: from.id,
          toConceptId: "concept_new",
          type: "PREREQUISITE_OF",
          evidenceChunkIds: [chunk.id]
        }
      });

      const listRes = await app.inject({ method: "GET", url: "/api/changesets" });
      expect(listRes.statusCode).toBe(200);
      const listed = GetChangesetsResponseSchema.parse(json(listRes));
      expect(listed.changesets.map((c) => c.id)).toContain("changeset_1");

      const detailRes = await app.inject({ method: "GET", url: "/api/changeset/changeset_1" });
      expect(detailRes.statusCode).toBe(200);
      const detail = GetChangesetResponseSchema.parse(json(detailRes));
      expect(detail.changeset.id).toBe("changeset_1");
      expect(detail.items).toHaveLength(2);
      expect(detail.evidenceChunks.map((c) => c.id)).toEqual(["chunk_1"]);

      const acceptConceptRes = await app.inject({
        method: "POST",
        url: "/api/changeset-item/changeset_item_concept/status",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: "accepted" })
      });
      expect(acceptConceptRes.statusCode).toBe(200);
      expect(PostChangesetItemStatusResponseSchema.parse(json(acceptConceptRes)).item.status).toBe(
        "accepted"
      );

      const acceptEdgeRes = await app.inject({
        method: "POST",
        url: "/api/changeset-item/changeset_item_edge/status",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: "accepted" })
      });
      expect(acceptEdgeRes.statusCode).toBe(200);

      const applyRes = await app.inject({
        method: "POST",
        url: "/api/changeset/changeset_1/apply"
      });
      expect(applyRes.statusCode).toBe(200);
      const applied = PostApplyChangesetResponseSchema.parse(json(applyRes));
      expect(applied.changeset.status).toBe("applied");
      expect(applied.applied.conceptIds).toEqual(["concept_new"]);
      expect(applied.applied.edgeIds).toHaveLength(1);

      const graphRes = await app.inject({ method: "GET", url: "/api/graph" });
      expect(graphRes.statusCode).toBe(200);
      const graph = GraphResponseSchema.parse(json(graphRes));
      expect(graph.nodes.map((n) => n.id)).toContain("concept_new");
      expect(graph.edges.map((e) => e.type)).toContain("PREREQUISITE_OF");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("Changeset patch flow: accept hunk, apply writes file, and updates file index", async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "graph-ai-tutor-vault-"));
    await fs.writeFile(path.join(vaultRoot, "note.md"), "hello\\nworld\\n", "utf8");

    const { app, db } = await createTestApp({ vaultRoot });
    try {
      const changeset = await db.changeset.create({ id: "changeset_patch_1" });
      await db.changesetItem.create({
        id: "changeset_item_patch_1",
        changesetId: changeset.id,
        entityType: "file",
        action: "patch",
        status: "pending",
        payload: {
          filePath: "note.md",
          unifiedDiff: "@@ -1,2 +1,2 @@\\n hello\\n-world\\n+there\\n"
        }
      });

      const acceptRes = await app.inject({
        method: "POST",
        url: "/api/changeset-item/changeset_item_patch_1/status",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: "accepted" })
      });
      expect(acceptRes.statusCode).toBe(200);

      const applyRes = await app.inject({
        method: "POST",
        url: "/api/changeset/changeset_patch_1/apply"
      });
      expect(applyRes.statusCode).toBe(200);
      const applied = PostApplyChangesetResponseSchema.parse(json(applyRes));
      expect(applied.changeset.status).toBe("applied");
      expect(applied.applied.conceptIds).toEqual([]);
      expect(applied.applied.edgeIds).toEqual([]);

      const updated = await fs.readFile(path.join(vaultRoot, "note.md"), "utf8");
      expect(updated).toBe("hello\\nthere\\n");

      const indexed = await db.vaultFile.getByPath("note.md");
      expect(indexed?.content).toBe("hello\\nthere\\n");

      const item = await db.changesetItem.getById("changeset_item_patch_1");
      expect(item?.status).toBe("applied");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("Concept merge flow: preview, apply creates aliases, undo restores", async () => {
    const { app, db } = await createTestApp();
    try {
      const canonical = await db.concept.create({ id: "concept_a", title: "A" });
      const duplicate = await db.concept.create({ id: "concept_b", title: "B" });
      const other = await db.concept.create({ id: "concept_c", title: "C" });

      const source = await db.source.create({ id: "source_1", url: "seed://source" });
      const chunk = await db.chunk.create({
        id: "chunk_1",
        sourceId: source.id,
        content: "Chunk evidence."
      });

      await db.edge.create({
        id: "edge_a_to_b",
        fromConceptId: canonical.id,
        toConceptId: duplicate.id,
        type: "PART_OF",
        evidenceChunkIds: [chunk.id]
      });
      await db.edge.create({
        id: "edge_b_to_c",
        fromConceptId: duplicate.id,
        toConceptId: other.id,
        type: "USED_IN",
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

      const previewRes = await app.inject({
        method: "POST",
        url: "/api/concept/merge/preview",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          canonicalId: canonical.id,
          duplicateIds: [duplicate.id]
        })
      });
      expect(previewRes.statusCode).toBe(200);
      const preview = PostConceptMergePreviewResponseSchema.parse(json(previewRes));
      expect(preview.canonical.id).toBe(canonical.id);
      expect(preview.duplicates.map((d) => d.id)).toEqual([duplicate.id]);
      expect(preview.counts.reviewItemsToUpdate).toBe(1);
      expect(preview.counts.edgesToRewire + preview.counts.edgesToDelete).toBeGreaterThan(0);

      const applyRes = await app.inject({
        method: "POST",
        url: "/api/concept/merge/apply",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          canonicalId: canonical.id,
          duplicateIds: [duplicate.id]
        })
      });
      expect(applyRes.statusCode).toBe(200);
      const applied = PostConceptMergeApplyResponseSchema.parse(json(applyRes));
      const mergeId = applied.merge.id;
      expect(applied.merge.canonicalId).toBe(canonical.id);
      expect(applied.merge.duplicateIds).toEqual([duplicate.id]);

      const aliasGet = await app.inject({ method: "GET", url: `/api/concept/${duplicate.id}` });
      expect(aliasGet.statusCode).toBe(200);
      const aliased = GetConceptResponseSchema.parse(json(aliasGet));
      expect(aliased.concept.id).toBe(canonical.id);

      const historyRes = await app.inject({
        method: "GET",
        url: `/api/concept/${canonical.id}/merges`
      });
      expect(historyRes.statusCode).toBe(200);
      const history = GetConceptMergesResponseSchema.parse(json(historyRes));
      expect(history.merges.map((m) => m.id)).toContain(mergeId);

      const undoRes = await app.inject({
        method: "POST",
        url: `/api/concept/merge/${mergeId}/undo`
      });
      expect(undoRes.statusCode).toBe(200);
      const undone = PostConceptMergeUndoResponseSchema.parse(json(undoRes));
      expect(undone.merge.undoneAt).not.toBeNull();

      const restoredGet = await app.inject({ method: "GET", url: `/api/concept/${duplicate.id}` });
      expect(restoredGet.statusCode).toBe(200);
      const restored = GetConceptResponseSchema.parse(json(restoredGet));
      expect(restored.concept.id).toBe(duplicate.id);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /tutor returns structured answer + citations", async () => {
    const db = await openDb({ pool: createMemPool() });
    const tutorLlm = {
      answer: async () => ({
        answer_markdown: "Answer.",
        cited_chunk_ids: ["chunk_1"],
        used_concept_ids: [],
        used_edge_ids: []
      })
    };
    const app = buildServer({ repos: db, tutorLlm });
    try {
      const source = await db.source.create({ id: "source_1", url: "seed://test/source" });
      await db.chunk.create({ id: "chunk_1", sourceId: source.id, content: "Evidence chunk." });

      const res = await app.inject({
        method: "POST",
        url: "/api/tutor",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ question: "What is this?" })
      });
      expect(res.statusCode).toBe(200);
      const parsed = PostTutorResponseSchema.parse(json(res));
      expect(parsed.result.cited_chunk_ids).toEqual(["chunk_1"]);
      expect(parsed.citations.map((c) => c.id)).toEqual(["chunk_1"]);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("Quiz generation flow: generate quizzes for a concept and list them", async () => {
    const db = await openDb({ pool: createMemPool() });

    const proposeDraft = vi.fn(async () => ({
      items: [
        {
          type: "CLOZE",
          prompt: "KV cache stores ___ during decoding.",
          answer: { blanks: ["keys and values"] }
        },
        {
          type: "ORDERING_STEPS",
          prompt: "Order the steps for using a KV cache during decoding.",
          answer: { orderedSteps: ["Initialize cache", "Append K/V per token", "Reuse past K/V"] }
        },
        {
          type: "COMPARE_CONTRAST",
          prompt: "Compare KV cache with PagedAttention.",
          answer: {
            otherConceptId: "concept_other",
            otherConceptTitle: "PagedAttention",
            similarities: ["Reduce recomputation during decoding"],
            differences: ["PagedAttention manages memory paging; KV cache is a general cache"]
          }
        }
      ]
    }));

    const finalize = vi.fn(async () => ({
      items: [
        {
          type: "CLOZE",
          prompt: "KV cache stores ___ during decoding.",
          answer: { blanks: ["keys and values"] },
          rubric: { explanation: "KV cache stores the key/value tensors so attention doesn't recompute past." }
        },
        {
          type: "ORDERING_STEPS",
          prompt: "Order the steps for using a KV cache during decoding.",
          answer: { orderedSteps: ["Initialize cache", "Append K/V per token", "Reuse past K/V"] },
          rubric: { explanation: "Correct order: init, append, then reuse." }
        },
        {
          type: "COMPARE_CONTRAST",
          prompt: "Compare KV cache with PagedAttention.",
          answer: {
            otherConceptId: "concept_other",
            otherConceptTitle: "PagedAttention",
            similarities: ["Reduce recomputation during decoding"],
            differences: ["PagedAttention manages KV memory paging; vanilla KV cache does not"]
          },
          rubric: { explanation: "Focus on memory management vs caching." }
        }
      ]
    }));

    const quizLlm = { proposeDraft, finalize };
    const app = buildServer({ repos: db, quizLlm });

    try {
      await db.concept.create({
        id: "concept_main",
        title: "KV cache",
        l0: "Cached key/value tensors during decoding.",
        l1: ["Avoid recomputing attention over previous tokens."],
        module: "inference"
      });
      await db.concept.create({
        id: "concept_other",
        title: "PagedAttention",
        l0: null,
        l1: [],
        module: "inference"
      });

      const genRes = await app.inject({
        method: "POST",
        url: "/api/concept/concept_main/quizzes/generate",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ count: 3 })
      });
      expect(genRes.statusCode).toBe(200);
      const generated = PostGenerateConceptQuizzesResponseSchema.parse(json(genRes));
      expect(generated.quizzes).toHaveLength(3);
      expect(new Set(generated.quizzes.map((q) => q.type))).toEqual(
        new Set(["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST"])
      );

      const listRes = await app.inject({
        method: "GET",
        url: "/api/concept/concept_main/quizzes"
      });
      expect(listRes.statusCode).toBe(200);
      const listed = GetConceptQuizzesResponseSchema.parse(json(listRes));
      expect(listed.quizzes.length).toBeGreaterThanOrEqual(3);

      expect(proposeDraft).toHaveBeenCalledTimes(1);
      expect(finalize).toHaveBeenCalledTimes(1);
      expect(await db.reviewItem.count()).toBe(3);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("Quiz generation returns 502 when LLM output violates schema", async () => {
    const db = await openDb({ pool: createMemPool() });
    const quizLlm = {
      proposeDraft: vi.fn(async () => ({
        items: [
          { type: "CLOZE", prompt: "X ___", answer: { blanks: ["y"] } },
          {
            type: "ORDERING_STEPS",
            prompt: "Order",
            answer: { orderedSteps: ["a", "b"] }
          },
          {
            type: "COMPARE_CONTRAST",
            prompt: "Compare",
            answer: {
              otherConceptId: "concept_other",
              otherConceptTitle: "Other",
              similarities: ["s"],
              differences: ["d"]
            }
          }
        ]
      })),
      finalize: vi.fn(async () => ({
        items: [
          {
            type: "CLOZE",
            prompt: "Missing rubric ___",
            answer: { blanks: ["x"] }
          }
        ]
      }))
    };
    const app = buildServer({ repos: db, quizLlm });

    try {
      await db.concept.create({ id: "concept_main", title: "Main" });
      await db.concept.create({ id: "concept_other", title: "Other" });

      const res = await app.inject({
        method: "POST",
        url: "/api/concept/concept_main/quizzes/generate",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ count: 3 })
      });
      expect(res.statusCode).toBe(502);
      expect(ApiErrorSchema.parse(json(res)).error.code).toBe("QUIZ_GENERATION_FAILED");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("selects due review items deterministically and grading updates schedule + mastery", async () => {
    const { app, db } = await createTestApp();
    try {
      const concept = await db.concept.create({
        id: "concept_review_main",
        title: "Review Concept",
        l0: null,
        l1: [],
        l2: [],
        module: null
      });

      await db.reviewItem.create({
        id: "review_item_a",
        conceptId: concept.id,
        type: "CLOZE",
        prompt: "A ___",
        answer: { blanks: ["x"] },
        rubric: { explanation: "x" },
        status: "active",
        dueAt: 0
      });
      await db.reviewItem.create({
        id: "review_item_b",
        conceptId: concept.id,
        type: "CLOZE",
        prompt: "B ___",
        answer: { blanks: ["y"] },
        rubric: { explanation: "y" },
        status: "active",
        dueAt: 0
      });

      const dueRes = await app.inject({ method: "GET", url: "/api/review/due?limit=10" });
      expect(dueRes.statusCode).toBe(200);
      const due = GetReviewDueResponseSchema.parse(json(dueRes));
      expect(due.items.map((i) => i.id)).toEqual(["review_item_a", "review_item_b"]);

      const beforeConcept = GetConceptResponseSchema.parse(
        json(await app.inject({ method: "GET", url: `/api/concept/${concept.id}` }))
      ).concept.masteryScore;

      const before = Date.now();
      const gradeRes = await app.inject({
        method: "POST",
        url: "/api/review/review_item_a/grade",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ grade: "correct" })
      });
      expect(gradeRes.statusCode).toBe(200);
      const graded = PostReviewGradeResponseSchema.parse(json(gradeRes));
      expect(graded.item.id).toBe("review_item_a");
      expect(graded.item.reps).toBe(1);
      expect(graded.item.interval).toBe(1);
      expect(graded.item.dueAt).not.toBeNull();
      const after = Date.now();
      expect(graded.item.dueAt ?? 0).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
      expect(graded.item.dueAt ?? 0).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);

      const dueAfterRes = await app.inject({
        method: "GET",
        url: "/api/review/due?limit=10"
      });
      expect(dueAfterRes.statusCode).toBe(200);
      const dueAfter = GetReviewDueResponseSchema.parse(json(dueAfterRes));
      expect(dueAfter.items.map((i) => i.id)).toEqual(["review_item_b"]);

      const afterConcept = GetConceptResponseSchema.parse(
        json(await app.inject({ method: "GET", url: `/api/concept/${concept.id}` }))
      ).concept.masteryScore;
      expect(afterConcept).toBeGreaterThan(beforeConcept);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /crawl enforces domain allowlist", async () => {
    const prev = process.env.CRAWLER_ALLOWLIST_DOMAINS;
    process.env.CRAWLER_ALLOWLIST_DOMAINS = "allowed.com";

    const fetchMock = vi.fn(async () => {
      throw new Error("fetch should not be called");
    });
    vi.stubGlobal("fetch", fetchMock);

    const extractionLlm: ExtractionLlm = {
      proposeCandidates: vi.fn(async () => ({ concepts: [], edges: [] }))
    };

    const { app, db } = await createTestApp({ extractionLlm });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/crawl",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ url: "https://not-allowed.com/docs" })
      });
      expect(res.statusCode).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
      await db.close();
      vi.unstubAllGlobals();
      if (typeof prev === "undefined") delete process.env.CRAWLER_ALLOWLIST_DOMAINS;
      else process.env.CRAWLER_ALLOWLIST_DOMAINS = prev;
    }
  });

  it("POST /crawl dedupes by normalized URL + content hash and returns the existing changeset", async () => {
    const prev = process.env.CRAWLER_ALLOWLIST_DOMAINS;
    process.env.CRAWLER_ALLOWLIST_DOMAINS = "allowed.com";

    function toArrayBuffer(text: string): ArrayBuffer {
      const u8 = new TextEncoder().encode(text);
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    }

    const body = "<html><body><p>KV cache speeds up decoding.</p></body></html>";
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = typeof input === "string" ? input : String(input);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null;
          }
        },
        arrayBuffer: async () => toArrayBuffer(body)
      };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const proposeCandidates = vi.fn(async (input: Parameters<ExtractionLlm["proposeCandidates"]>[0]) => ({
      concepts: [
        {
          id: "concept_extracted_a",
          title: "KV cache",
          l0: null,
          l1: [],
          module: null,
          evidenceChunkIds: [input.chunks[0].id]
        }
      ],
      edges: []
    }));

    const extractionLlm: ExtractionLlm = { proposeCandidates };

    const { app, db } = await createTestApp({ extractionLlm });
    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/crawl",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ url: "https://allowed.com/docs?b=2&a=1#frag" })
      });
      expect(first.statusCode).toBe(200);
      const firstBody = PostCrawlResponseSchema.parse(json(first));
      expect(firstBody.deduped).toBe(false);
      expect(firstBody.changesetId).not.toBeNull();

      const second = await app.inject({
        method: "POST",
        url: "/api/crawl",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ url: "https://ALLOWED.com/docs/?a=1&b=2" })
      });
      expect(second.statusCode).toBe(200);
      const secondBody = PostCrawlResponseSchema.parse(json(second));
      expect(secondBody.deduped).toBe(true);
      expect(secondBody.changesetId).toBe(firstBody.changesetId);

      expect(await db.changeset.count()).toBe(1);
      expect(proposeCandidates).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      await db.close();
      vi.unstubAllGlobals();
      if (typeof prev === "undefined") delete process.env.CRAWLER_ALLOWLIST_DOMAINS;
      else process.env.CRAWLER_ALLOWLIST_DOMAINS = prev;
    }
  });

  it("POST /capture creates changeset from learning note", async () => {
    const captureLlm: CaptureLlm = {
      propose: vi.fn(async () => ({
        concepts: [
          {
            id: "concept_captured",
            title: "Captured concept",
            l0: "Something learned",
            l1: [],
            module: null,
            evidence: "user said so",
            confidence: 0.85
          }
        ],
        edges: []
      }))
    };

    const { app, db } = await createTestApp({ captureLlm });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/capture",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ text: "I learned about captured concept" })
      });
      expect(res.statusCode).toBe(200);
      const parsed = PostCaptureResponseSchema.parse(json(res));
      expect(parsed.changesetId).toBeTruthy();
      expect(parsed.itemsCreated).toBe(1);
      expect(parsed.sourceId).toBeTruthy();

      const changeset = await db.changeset.getById(parsed.changesetId);
      expect(changeset).toBeTruthy();
      expect(changeset!.status).toBe("draft");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept/:id/context-pack returns markdown for 1-hop", async () => {
    const { app, db } = await createTestApp();
    try {
      const c1Res = await app.inject({
        method: "POST",
        url: "/api/concept",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "KV cache",
          l0: "Keys/values cached during decoding.",
          l1: ["Speeds up decoding"],
          module: "inference"
        })
      });
      const c1 = PostConceptResponseSchema.parse(json(c1Res)).concept;

      const c2Res = await app.inject({
        method: "POST",
        url: "/api/concept",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "Self-attention",
          l0: "Attention mechanism.",
          l1: ["QKV"],
          module: "foundations"
        })
      });
      const c2 = PostConceptResponseSchema.parse(json(c2Res)).concept;

      await app.inject({
        method: "POST",
        url: "/api/edge",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          fromConceptId: c1.id,
          toConceptId: c2.id,
          type: "PREREQUISITE_OF"
        })
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/concept/${c1.id}/context-pack`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          radius: "1-hop",
          includeQuiz: false
        })
      });
      expect(res.statusCode).toBe(200);
      const body = PostContextPackResponseSchema.parse(json(res));
      expect(body.markdown).toContain("KV cache");
      expect(body.markdown).toContain("Self-attention");
      expect(body.conceptIds).toContain(c1.id);
      expect(body.conceptIds).toContain(c2.id);
      expect(body.fileName).toMatch(/\.md$/);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /concept/:id/context-pack returns 404 for missing concept", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/concept/concept_missing/context-pack",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ radius: "1-hop" })
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
      await db.close();
    }
  });

  // --- Training session tests ---

  it("POST /training/session creates a training session", async () => {
    const trainingLlm = createMockTrainingLlm();
    const { app, db } = await createTestApp({ trainingLlm });
    try {
      const concept = await db.concept.create({ title: "Gradient Descent" });

      const res = await app.inject({
        method: "POST",
        url: "/api/training/session",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ conceptIds: [concept.id] })
      });
      expect(res.statusCode).toBe(200);

      const body = PostCreateTrainingSessionResponseSchema.parse(json(res));
      expect(body.session.status).toBe("active");
      expect(body.session.conceptIds).toContain(concept.id);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.questions.length).toBeGreaterThan(0);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /training/session/:id retrieves a session", async () => {
    const trainingLlm = createMockTrainingLlm();
    const { app, db } = await createTestApp({ trainingLlm });
    try {
      const concept = await db.concept.create({ title: "Backpropagation" });

      const createRes = await app.inject({
        method: "POST",
        url: "/api/training/session",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ conceptIds: [concept.id] })
      });
      const created = PostCreateTrainingSessionResponseSchema.parse(json(createRes));

      const res = await app.inject({
        method: "GET",
        url: `/api/training/session/${created.session.id}`
      });
      expect(res.statusCode).toBe(200);

      const body = GetTrainingSessionResponseSchema.parse(json(res));
      expect(body.session.id).toBe(created.session.id);
      expect(body.items.length).toBe(created.items.length);
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /training/session/:id/item/:itemId/submit grades an answer", async () => {
    const trainingLlm = createMockTrainingLlm();
    const { app, db } = await createTestApp({ trainingLlm });
    try {
      const concept = await db.concept.create({ title: "Loss Functions" });

      const createRes = await app.inject({
        method: "POST",
        url: "/api/training/session",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ conceptIds: [concept.id] })
      });
      const created = PostCreateTrainingSessionResponseSchema.parse(json(createRes));

      const firstItem = created.items[0]!;
      const res = await app.inject({
        method: "POST",
        url: `/api/training/session/${created.session.id}/item/${firstItem.id}/submit`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ answer: "Gradient descent computes gradients and updates weights." })
      });
      expect(res.statusCode).toBe(200);

      const body = PostSubmitTrainingAnswerResponseSchema.parse(json(res));
      expect(body.item.grade).not.toBeNull();
      expect(body.item.feedback).not.toBeNull();
      expect(body.item.userAnswer).toBe("Gradient descent computes gradients and updates weights.");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("POST /training/session/:id/complete completes a session", async () => {
    const trainingLlm = createMockTrainingLlm();
    const { app, db } = await createTestApp({ trainingLlm });
    try {
      const concept = await db.concept.create({ title: "Regularization" });

      const createRes = await app.inject({
        method: "POST",
        url: "/api/training/session",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ conceptIds: [concept.id] })
      });
      const created = PostCreateTrainingSessionResponseSchema.parse(json(createRes));

      const res = await app.inject({
        method: "POST",
        url: `/api/training/session/${created.session.id}/complete`
      });
      expect(res.statusCode).toBe(200);

      const body = PostCompleteTrainingSessionResponseSchema.parse(json(res));
      expect(body.session.status).toBe("completed");
      expect(body.session.completedAt).toBeTypeOf("number");
    } finally {
      await app.close();
      await db.close();
    }
  });

  it("GET /training/session/:id returns 404 for non-existent session", async () => {
    const { app, db } = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/training/session/ts_nonexistent"
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
      await db.close();
    }
  });
});
