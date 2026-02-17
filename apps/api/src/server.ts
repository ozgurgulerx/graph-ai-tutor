import crypto from "node:crypto";

import Fastify from "fastify";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { ApplyAcceptedOptions, Db, Repositories } from "@graph-ai-tutor/db";
import {
  ChangesetItemParamsSchema,
  GetChangesetParamsSchema,
  GetChangesetResponseSchema,
  GetChangesetsResponseSchema,
  GetConceptDraftRevisionsResponseSchema,
  GetConceptParamsSchema,
  GetConceptResponseSchema,
  GetConceptQuizzesResponseSchema,
  GetConceptSourcesResponseSchema,
  GetEdgeEvidenceResponseSchema,
  GetEdgeParamsSchema,
  GetSourceParamsSchema,
  GetReviewDueQuerySchema,
  GetReviewDueResponseSchema,
  GraphClusteredResponseSchema,
  GraphLensQuerySchema,
  GraphLensResponseSchema,
  GraphQuerySchema,
  GraphResponseSchema,
  PostApplyChangesetResponseSchema,
  PostChangesetItemStatusRequestSchema,
  PostChangesetItemStatusResponseSchema,
  PostChangesetStatusRequestSchema,
  PostChangesetStatusResponseSchema,
  PostConceptRequestSchema,
  PostConceptResponseSchema,
  PostConceptDistillResponseSchema,
  PostConceptMergeApplyRequestSchema,
  PostConceptMergeApplyResponseSchema,
  PostConceptMergePreviewRequestSchema,
  PostConceptMergePreviewResponseSchema,
  PostConceptMergeUndoResponseSchema,
  PostConceptSourceRequestSchema,
  PostConceptSourceResponseSchema,
  PostConceptLocalSourceRequestSchema,
  PostConceptLocalSourceResponseSchema,
  GetSourceContentResponseSchema,
  PostSourceContentRequestSchema,
  PostSourceContentResponseSchema,
  PostCrawlRequestSchema,
  PostCrawlResponseSchema,
  PostDraftRevisionApplyResponseSchema,
  PostDraftRevisionRejectResponseSchema,
  PostDraftRevisionRevertResponseSchema,
  PostDraftEdgeRequestSchema,
  PostDraftEdgeResponseSchema,
  PostEdgeRequestSchema,
  PostEdgeResponseSchema,
  PostGenerateConceptQuizzesRequestSchema,
  PostGenerateConceptQuizzesResponseSchema,
  PostReviewGradeRequestSchema,
  PostReviewGradeResponseSchema,
  PostTutorRequestSchema,
  PostTutorResponseSchema,
  ConceptMergeParamsSchema,
  GetConceptMergesResponseSchema,
  PostContextPackRequestSchema,
  PostContextPackResponseSchema,
  ReviewItemParamsSchema,
  SearchQuerySchema,
  SearchExactResponseSchema,
  SearchResponseSchema,
  SearchUniversalQuerySchema,
  SearchUniversalResponseSchema,
  PostCaptureRequestSchema,
  PostCaptureResponseSchema,
  PostCreateTrainingSessionRequestSchema,
  PostCreateTrainingSessionResponseSchema,
  GetTrainingSessionResponseSchema,
  PostSubmitTrainingAnswerRequestSchema,
  PostSubmitTrainingAnswerResponseSchema,
  PostCompleteTrainingSessionResponseSchema,
  TrainingSessionParamsSchema,
  TrainingSessionItemParamsSchema,
  computeGraphLens,
  wouldCreatePrereqCycle,
  GetConceptNoteResponseSchema,
  PostConceptNoteRequestSchema,
  PostConceptNoteResponseSchema,
  GetConceptBacklinksResponseSchema,
  PostGenerateConceptContextResponseSchema,
  PostUpdateConceptContextRequestSchema,
  PostUpdateConceptContextResponseSchema,
  ShortestPathQuerySchema,
  ShortestPathResponseSchema,
  computePageRank,
  detectCommunities,
  PostDocIngestResolveRequestSchema,
  PostDocIngestResolveResponseSchema,
  PostDocIngestConfirmRequestSchema,
  PostDocIngestConfirmResponseSchema,
  PostSmartAddResolveRequestSchema,
  PostSmartAddResolveResponseSchema,
  PostSmartAddConfirmRequestSchema,
  PostSmartAddConfirmResponseSchema
} from "@graph-ai-tutor/shared";

import { createOpenAiCaptureLlm, runCaptureJob, type CaptureLlm } from "./capture";
import { createOpenAiDocIngestLlm, runDocIngestResolve, type DocIngestLlm } from "./doc-ingest";
import { createOpenAiSmartAddLlm, runSmartAddResolve, type SmartAddLlm } from "./smart-add";
import {
  createOpenAiTrainingLlm,
  generateTrainingQuestions,
  gradeTrainingAnswer,
  type TrainingLlm
} from "./training";
import { collectConceptIds, generateContextPack } from "./context-pack";
import { createOpenAIResponsesClient, resolveModel, runStructuredOutput } from "@graph-ai-tutor/llm";
import { createOpenAiDistillLlm, runDistillJob, type DistillLlm } from "./distill";
import { createOpenAiExtractionLlm, runExtractionJob, type ExtractionLlm } from "./extraction";
import { createOpenAiQuizLlm, generateQuizSpecs, type QuizCandidateConcept, type QuizLlm } from "./quizzes";
import { createOpenAiTutorLlm, runTutorJob, type TutorLlm } from "./tutor";
import { applyAcceptedFilePatchItemsToVault } from "./changesets/file-patches";
import {
  chunkText,
  fetchTextContent,
  htmlToText,
  isUrlAllowed,
  normalizeUrl,
  parseAllowlistDomains,
  sha256Hex
} from "./crawler";
import { GraphCache } from "./graph-cache";
import { findPotentialDuplicateConcepts } from "./concept-duplicates";
import { isVaultUrl, readVaultTextFile, resolveVaultUrlToPath, writeVaultTextFileAtomic } from "./vault";

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues?: unknown } };

type ZodSchema<T> = {
  safeParse(input: unknown): SafeParseResult<T>;
};

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  reply.status(statusCode).send({
    error: {
      code,
      message,
      ...(typeof details === "undefined" ? {} : { details })
    }
  });
}

function parseOr400<T>(reply: FastifyReply, schema: ZodSchema<T>, input: unknown): T | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  sendError(reply, 400, "VALIDATION_ERROR", "Invalid request", parsed.error.issues);
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (!value.every((x) => typeof x === "string")) return [];
  return value;
}

async function resolveConceptId(repos: Repositories, id: string): Promise<string | null> {
  const direct = await repos.concept.getById(id);
  if (direct) return direct.id;

  const canonicalId = await repos.conceptAlias.getCanonicalId(id);
  if (!canonicalId) return null;

  const canonical = await repos.concept.getById(canonicalId);
  if (!canonical) return null;
  return canonical.id;
}

async function rejectIfDuplicateConcept(
  reply: FastifyReply,
  repos: Repositories,
  data: {
    title: string;
    module?: string | null;
    kind?: string;
  }
): Promise<boolean> {
  const duplicates = await findPotentialDuplicateConcepts({
    repos,
    title: data.title,
    module: data.module,
    kind: data.kind
  });

  if (duplicates.length === 0) return false;

  sendError(reply, 409, "CONCEPT_DUPLICATE", "A similar concept already exists", {
    matches: duplicates
  });
  return true;
}

function titleFromMarkdown(content: string): string | null {
  // Prefer the first markdown heading anywhere in the document.
  // Ensure we never return multi-line titles, even if the content contains unexpected line separators.
  const headingMatch = content.match(/^#{1,6}\s+([^\r\n]+)\s*$/m);
  if (headingMatch) {
    const title = headingMatch[1]?.trim();
    if (title) return title;
  }

  // Fallback: first non-empty line (useful for plain-text notes).
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "---") continue; // ignore frontmatter fences
    return line;
  }

  return null;
}

const ConceptDraftRevisionParamsSchema = z.object({
  id: z.string(),
  revisionId: z.string()
});

const QUIZ_TYPE_SET = new Set(["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST"]);

export type ServerDeps = {
  repos: Db;
  vaultRoot?: string;
  reindexBus?: import("node:events").EventEmitter;
  tutorLlm?: TutorLlm;
  distillLlm?: DistillLlm;
  quizLlm?: QuizLlm;
  extractionLlm?: ExtractionLlm;
  captureLlm?: CaptureLlm;
  trainingLlm?: TrainingLlm;
  docIngestLlm?: DocIngestLlm;
  smartAddLlm?: SmartAddLlm;
};

function registerApiRoutes(
  app: FastifyInstance,
  deps: ServerDeps,
  crawlerAllowlistDomains: string[],
  graphCache: GraphCache
) {
  app.post("/crawl", async (req, reply) => {
    if (crawlerAllowlistDomains.length === 0) {
      sendError(
        reply,
        501,
        "CRAWLER_NOT_CONFIGURED",
        "CRAWLER_ALLOWLIST_DOMAINS is required to enable crawling"
      );
      return;
    }

    const body = parseOr400(reply, PostCrawlRequestSchema, req.body ?? {});
    if (!body) return;

    let normalizedRequestUrl: string;
    try {
      normalizedRequestUrl = normalizeUrl(body.url);
    } catch (err) {
      sendError(
        reply,
        400,
        "UNSUPPORTED_URL",
        err instanceof Error ? err.message : "Unsupported URL"
      );
      return;
    }

    if (!isUrlAllowed(normalizedRequestUrl, crawlerAllowlistDomains)) {
      sendError(reply, 403, "DOMAIN_NOT_ALLOWED", "URL domain is not allowlisted", {
        url: normalizedRequestUrl
      });
      return;
    }

    let fetched: { finalUrl: string; contentType: string | null; text: string };
    try {
      fetched = await fetchTextContent(normalizedRequestUrl);
    } catch (err) {
      sendError(reply, 502, "FETCH_FAILED", err instanceof Error ? err.message : "Fetch failed");
      app.log.error(err);
      return;
    }

    let normalizedFinalUrl: string;
    try {
      normalizedFinalUrl = normalizeUrl(fetched.finalUrl);
    } catch {
      normalizedFinalUrl = normalizedRequestUrl;
    }

    if (!isUrlAllowed(normalizedFinalUrl, crawlerAllowlistDomains)) {
      sendError(reply, 403, "DOMAIN_NOT_ALLOWED", "Redirected URL domain is not allowlisted", {
        url: normalizedFinalUrl
      });
      return;
    }

    const contentType = fetched.contentType;
    const ct = (contentType ?? "").toLowerCase();
    const isTextLike =
      ct === "" || ct.startsWith("text/") || ct.includes("html") || ct.includes("xml") || ct.includes("json");
    if (!isTextLike) {
      sendError(reply, 415, "UNSUPPORTED_CONTENT_TYPE", "Only text content is supported", {
        contentType
      });
      return;
    }

    const raw = fetched.text;
    const contentHash = sha256Hex(raw);

    let source = await deps.repos.source.getByUrl(normalizedFinalUrl);
    if (!source) {
      try {
        source = await deps.repos.source.create({ url: normalizedFinalUrl, title: null });
      } catch {
        source = await deps.repos.source.getByUrl(normalizedFinalUrl);
      }
    }

    if (!source) {
      sendError(reply, 500, "INTERNAL", "Failed to create or fetch source");
      return;
    }

    const existingContent = await deps.repos.sourceContent.getBySourceId(source.id);
    const latestChangesetId = await deps.repos.changeset.getLatestIdBySourceId(source.id);
    if (existingContent && existingContent.contentHash === contentHash && latestChangesetId) {
      const payload = { source, deduped: true, changesetId: latestChangesetId };
      const validated = parseOr400(reply, PostCrawlResponseSchema, payload);
      if (!validated) return;
      return validated;
    }

    let llm: ExtractionLlm;
    try {
      llm = deps.extractionLlm ?? createOpenAiExtractionLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Extraction LLM not configured"
      );
      return;
    }

    await deps.repos.sourceContent.upsert({
      sourceId: source.id,
      content: raw,
      contentHash,
      contentType: contentType ?? null
    });

    const textForChunks = ct.includes("html") ? htmlToText(raw) : raw;
    const chunkSpecs = chunkText(textForChunks);
    if (chunkSpecs.length === 0) {
      sendError(reply, 400, "EMPTY_CONTENT", "No text extracted to chunk");
      return;
    }

    const createdChunks = [];
    for (const c of chunkSpecs) {
      createdChunks.push(await deps.repos.chunk.create({
        sourceId: source.id,
        content: c.content,
        startOffset: c.startOffset,
        endOffset: c.endOffset
      }));
    }

    try {
      const extraction = await runExtractionJob({
        repos: deps.repos,
        sourceId: source.id,
        llm,
        chunks: createdChunks
      });
      const payload = { source, deduped: false, changesetId: extraction.changesetId };
      const validated = parseOr400(reply, PostCrawlResponseSchema, payload);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        502,
        "EXTRACTION_FAILED",
        err instanceof Error ? err.message : "Extraction failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.get("/graph", async (req, reply) => {
    // ETag-based caching: return 304 if graph hasn't changed
    const graphVersion = await deps.repos.getGraphVersion();
    const etag = `"graph-${graphVersion}"`;
    reply.header("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      reply.status(304).send();
      return;
    }

    // Server-side cache
    const cacheKey = `graph:${req.url}`;
    const cached = graphCache.get(cacheKey);
    if (cached) return cached;

    const query = parseOr400(reply, GraphQuerySchema, req.query ?? {});
    if (!query) return;

    const typeAllowlist: Set<string> = new Set(query.typeFilters);
    const allowEdgeType = (type: string) => typeAllowlist.size === 0 || typeAllowlist.has(type);

    const center = query.center?.trim();
    if (!center) {
      const nodes = await deps.repos.concept.listSummaries();
      const edgesAll = await deps.repos.edge.listSummaries();
      const edges = typeAllowlist.size === 0 ? edgesAll : edgesAll.filter((e) => allowEdgeType(e.type));

      const payload = { nodes, edges };
      const validated = parseOr400(reply, GraphResponseSchema, payload);
      if (!validated) return;
      graphCache.set(cacheKey, validated);
      return validated;
    }

    const centerId = await resolveConceptId(deps.repos, center);
    if (!centerId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: center });
      return;
    }

    const depth = query.depth;

    // Try CTE-based BFS first (single round-trip), fall back to iterative
    let seen = await deps.repos.edge.listNeighborhoodCTE(centerId, depth);
    if (!seen) {
      seen = new Set<string>([centerId]);
      let frontier = new Set<string>([centerId]);
      for (let i = 0; i < depth; i++) {
        if (frontier.size === 0) break;
        const frontierEdges = await deps.repos.edge.listSummariesByConceptIds(Array.from(frontier), 10_000);
        const next = new Set<string>();
        for (const edge of frontierEdges) {
          if (!allowEdgeType(edge.type)) continue;
          if (!seen.has(edge.fromConceptId)) next.add(edge.fromConceptId);
          if (!seen.has(edge.toConceptId)) next.add(edge.toConceptId);
          seen.add(edge.fromConceptId);
          seen.add(edge.toConceptId);
        }
        frontier = next;
      }
    }

    const ids = Array.from(seen);
    let nodes = await deps.repos.concept.listSummariesByIds(ids);

    // Use confidence-aware edge query when caps are active
    const hasCaps = query.maxNodes != null || query.maxEdges != null;
    let edges: { id: string; fromConceptId: string; toConceptId: string; type: string }[];
    let capped = false;

    if (hasCaps) {
      const edgesWithConf = await deps.repos.edge.listSummariesByConceptIdsWithConfidence(ids, 50_000);
      let filteredEdges = edgesWithConf.filter(
        (e) => allowEdgeType(e.type) && seen.has(e.fromConceptId) && seen.has(e.toConceptId)
      );

      // Cap edges by confidence
      if (query.maxEdges != null && filteredEdges.length > query.maxEdges) {
        filteredEdges.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
        filteredEdges = filteredEdges.slice(0, query.maxEdges);
        capped = true;
      }

      // Cap nodes by degree (center always kept first)
      if (query.maxNodes != null && nodes.length > query.maxNodes) {
        const degree = new Map<string, number>();
        for (const e of filteredEdges) {
          degree.set(e.fromConceptId, (degree.get(e.fromConceptId) ?? 0) + 1);
          degree.set(e.toConceptId, (degree.get(e.toConceptId) ?? 0) + 1);
        }
        nodes.sort((a, b) => {
          if (a.id === centerId) return -1;
          if (b.id === centerId) return 1;
          return (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0);
        });
        nodes = nodes.slice(0, query.maxNodes);
        const keptIds = new Set(nodes.map((n) => n.id));
        filteredEdges = filteredEdges.filter(
          (e) => keptIds.has(e.fromConceptId) && keptIds.has(e.toConceptId)
        );
        capped = true;
      }

      // Strip confidence from response edges
      edges = filteredEdges.map(({ id, fromConceptId, toConceptId, type }) => ({
        id, fromConceptId, toConceptId, type
      }));
    } else {
      const edgeCandidates = await deps.repos.edge.listSummariesByConceptIds(ids, 50_000);
      edges = edgeCandidates.filter(
        (e) => allowEdgeType(e.type) && seen.has(e.fromConceptId) && seen.has(e.toConceptId)
      );
    }

    const payload = { nodes, edges, capped };
    const validated = parseOr400(reply, GraphResponseSchema, payload);
    if (!validated) return;
    graphCache.set(cacheKey, validated);
    return validated;
  });

  app.get("/graph/lens", async (req, reply) => {
    // ETag-based caching
    const graphVersion = await deps.repos.getGraphVersion();
    const etag = `"lens-${graphVersion}"`;
    reply.header("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      reply.status(304).send();
      return;
    }

    const query = parseOr400(reply, GraphLensQuerySchema, req.query ?? {});
    if (!query) return;

    const centerId = await resolveConceptId(deps.repos, query.center);
    if (!centerId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: query.center });
      return;
    }

    // Phase 1: Discover nodes via undirected BFS through PREREQUISITE_OF edges
    // Try CTE-based BFS first (single round-trip), fall back to iterative
    let seen = await deps.repos.edge.listNeighborhoodCTE(centerId, query.radius, "PREREQUISITE_OF");
    if (!seen) {
      seen = new Set<string>([centerId]);
      let frontier = new Set<string>([centerId]);
      for (let i = 0; i < query.radius; i++) {
        if (frontier.size === 0) break;
        const frontierEdges = await deps.repos.edge.listSummariesByConceptIds(
          Array.from(frontier),
          10_000
        );
        const next = new Set<string>();
        for (const edge of frontierEdges) {
          if (edge.type !== "PREREQUISITE_OF") continue;
          for (const endpoint of [edge.fromConceptId, edge.toConceptId]) {
            if (!seen.has(endpoint)) {
              seen.add(endpoint);
              next.add(endpoint);
            }
          }
        }
        frontier = next;
      }
    }

    // Phase 2: Fetch all edges between discovered nodes (including secondary types)
    const allNodeIds = Array.from(seen);
    const allEdges = await deps.repos.edge.listSummariesByConceptIds(allNodeIds, 50_000);

    // Phase 3: Fetch node summaries
    const allNodes = await deps.repos.concept.listSummariesByIds(allNodeIds);

    // Phase 4: Compute lens
    const lensResult = computeGraphLens({
      centerId,
      radius: query.radius,
      edges: allEdges,
      nodes: allNodes,
      edgeTypeFilter: query.edgeTypes
    });

    // Phase 5: Filter to only lens-relevant nodes and edges
    const nodes = allNodes.filter((n) => lensResult.nodeIds.has(n.id));
    const edges = allEdges.filter((e) => lensResult.edgeIds.has(e.id));

    const lensPayload = {
      nodes,
      edges,
      metadata: lensResult.metadata,
      warnings: lensResult.warnings
    };
    const lensValidated = parseOr400(reply, GraphLensResponseSchema, lensPayload);
    if (!lensValidated) return;
    return lensValidated;
  });

  app.get("/graph/clustered", async (_req, reply) => {
    const groups = await deps.repos.concept.listSummariesGroupedByModule();
    const allEdges = await deps.repos.edge.listSummaries();

    let clusters = groups
      .filter((g) => g.module !== "(uncategorized)")
      .map((g) => ({
        module: g.module,
        count: g.count,
        conceptIds: g.conceptIds
      }));

    // If module-based clusters are sparse, use computed community labels
    const totalNodes = groups.reduce((sum, g) => sum + g.count, 0);
    const clusteredNodeCount = clusters.reduce((sum, c) => sum + c.count, 0);
    if (totalNodes > 0 && clusteredNodeCount / totalNodes < 0.5) {
      const allSummaries = await deps.repos.concept.listSummaries();
      const communityGroups = new Map<string, string[]>();
      for (const s of allSummaries) {
        if (!s.community) continue;
        const arr = communityGroups.get(s.community) ?? [];
        arr.push(s.id);
        communityGroups.set(s.community, arr);
      }
      if (communityGroups.size > 0) {
        let idx = 0;
        clusters = Array.from(communityGroups.entries())
          .filter(([, ids]) => ids.length > 1)
          .map(([, ids]) => ({
            module: `Community ${++idx}`,
            count: ids.length,
            conceptIds: ids
          }));
      }
    }

    const clusteredConceptIds = new Set<string>();
    for (const c of clusters) {
      for (const id of c.conceptIds) clusteredConceptIds.add(id);
    }

    const moduleByConceptId = new Map<string, string>();
    for (const c of clusters) {
      for (const id of c.conceptIds) moduleByConceptId.set(id, c.module);
    }

    const interClusterEdges = allEdges.filter((e) => {
      const fromMod = moduleByConceptId.get(e.fromConceptId);
      const toMod = moduleByConceptId.get(e.toConceptId);
      return fromMod && toMod && fromMod !== toMod;
    });

    const unclusteredGroup = groups.find((g) => g.module === "(uncategorized)");
    const unclustered = unclusteredGroup
      ? await deps.repos.concept.listSummariesByIds(
          unclusteredGroup.conceptIds.filter((id) => !clusteredConceptIds.has(id))
        )
      : [];

    const payload = { clusters, interClusterEdges, unclustered };
    const validated = parseOr400(reply, GraphClusteredResponseSchema, payload);
    if (!validated) return;
    return validated;
  });

  app.get("/graph/shortest-path", async (req, reply) => {
    const query = parseOr400(reply, ShortestPathQuerySchema, req.query ?? {});
    if (!query) return;

    const fromId = await resolveConceptId(deps.repos, query.from);
    if (!fromId) {
      sendError(reply, 404, "NOT_FOUND", "Source concept not found", { id: query.from });
      return;
    }

    const toId = await resolveConceptId(deps.repos, query.to);
    if (!toId) {
      sendError(reply, 404, "NOT_FOUND", "Target concept not found", { id: query.to });
      return;
    }

    const path = await deps.repos.edge.findShortestPath(fromId, toId, query.maxDepth);
    const nodes = path ? await deps.repos.concept.listSummariesByIds(path) : [];
    const validated = parseOr400(reply, ShortestPathResponseSchema, { path, nodes });
    if (!validated) return;
    return validated;
  });

  app.post("/graph/recompute-pagerank", async () => {
    const allNodes = await deps.repos.concept.listSummaries();
    const allEdges = await deps.repos.edge.listSummaries();
    const nodeIds = allNodes.map((n) => n.id);
    const edges = allEdges.map((e) => ({
      fromConceptId: e.fromConceptId,
      toConceptId: e.toConceptId
    }));
    const ranks = computePageRank(nodeIds, edges);
    await deps.repos.concept.updatePageRanks(ranks);
    graphCache.invalidate();
    return { updated: ranks.size };
  });

  app.post("/graph/recompute-communities", async () => {
    const allNodes = await deps.repos.concept.listSummaries();
    const allEdges = await deps.repos.edge.listSummaries();
    const nodeIds = allNodes.map((n) => n.id);
    const edges = allEdges.map((e) => ({
      fromConceptId: e.fromConceptId,
      toConceptId: e.toConceptId
    }));
    const communities = detectCommunities(nodeIds, edges);
    await deps.repos.concept.updateCommunities(communities);
    graphCache.invalidate();
    return { updated: communities.size };
  });

  app.get("/concept/:id", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }
    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    const validated = parseOr400(reply, GetConceptResponseSchema, { concept });
    if (!validated) return;
    return validated;
  });

  // Alias: "node" nomenclature while the UI and docs still use "concept".
  app.get("/node/:id", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Node not found", { id: params.id });
      return;
    }
    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Node not found", { id: conceptId });
      return;
    }

    const validated = parseOr400(reply, GetConceptResponseSchema, { concept });
    if (!validated) return;
    return validated;
  });

  app.get("/concept/:id/sources", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const sources = await deps.repos.conceptSource.listSources(conceptId);
    const validated = parseOr400(reply, GetConceptSourcesResponseSchema, { sources });
    if (!validated) return;
    return validated;
  });

  app.get("/concept/:id/quizzes", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const items = await deps.repos.reviewItem.listByConceptId(conceptId, 200);
    const quizzes = items
      .filter((i) => QUIZ_TYPE_SET.has(i.type) && i.answer !== null && i.rubric !== null)
      .map((i) => ({
        id: i.id,
        conceptId,
        type: i.type,
        prompt: i.prompt,
        answer: i.answer,
        rubric: i.rubric,
        status: i.status,
        dueAt: i.dueAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      }));

    const validated = parseOr400(reply, GetConceptQuizzesResponseSchema, { quizzes });
    if (!validated) return;
    return validated;
  });

  app.post("/concept/:id/quizzes/generate", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostGenerateConceptQuizzesRequestSchema, req.body ?? {});
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }
    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    let llm: QuizLlm;
    try {
      llm = deps.quizLlm ?? createOpenAiQuizLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Quiz generator LLM not configured"
      );
      return;
    }

    const candidateConcepts: QuizCandidateConcept[] = (await deps.repos.concept.listSummaries())
      .filter((c) => c.id !== conceptId)
      .slice(0, 50)
      .map((c) => ({ id: c.id, title: c.title }));

    try {
      const specs = await generateQuizSpecs({
        concept: {
          id: conceptId,
          title: concept.title,
          l0: concept.l0,
          l1: concept.l1,
          module: concept.module
        },
        candidateConcepts,
        count: body.count,
        llm
      });

      const quizzes: unknown[] = [];
      for (const spec of specs) {
        const id = `review_item_${crypto.randomUUID()}`;
        await deps.repos.reviewItem.create({
          id,
          conceptId: conceptId,
          type: spec.type,
          prompt: spec.prompt,
          answer: spec.answer,
          rubric: spec.rubric,
          status: "draft",
          dueAt: null
        });

        const created = await deps.repos.reviewItem.getById(id);
        if (!created) throw new Error("Failed to load created review item");

        quizzes.push({
          id: created.id,
          conceptId: conceptId,
          type: created.type,
          prompt: created.prompt,
          answer: created.answer,
          rubric: created.rubric,
          status: created.status,
          dueAt: created.dueAt,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt
        });
      }

      const validated = parseOr400(reply, PostGenerateConceptQuizzesResponseSchema, { quizzes });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Quiz generation failed";
      sendError(reply, 502, "QUIZ_GENERATION_FAILED", message);
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/context-pack", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostContextPackRequestSchema, req.body ?? {});
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    try {
      const result = await generateContextPack(deps.repos, {
        conceptId,
        radius: body.radius,
        includeCode: body.includeCode,
        includeQuiz: body.includeQuiz
      });

      const validated = parseOr400(reply, PostContextPackResponseSchema, result);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "CONTEXT_PACK_FAILED",
        err instanceof Error ? err.message : "Context pack generation failed"
      );
      app.log.error(err);
      return;
    }
  });

  // --- Concept Context (LLM-generated) ---

  app.post("/concept/:id/generate-context", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    try {
      // Collect 1-hop subgraph
      const conceptIds = await collectConceptIds(deps.repos, {
        conceptId,
        radius: "1-hop",
        includeCode: false,
        includeQuiz: false
      });

      const concepts = (
        await Promise.all(conceptIds.map((id) => deps.repos.concept.getById(id)))
      ).filter((c) => c !== null);

      const relevantEdges =
        conceptIds.length > 0
          ? await deps.repos.edge.listSummariesByConceptIds(conceptIds, 5000)
          : [];
      const conceptIdSet = new Set(conceptIds);
      const internalEdges = relevantEdges.filter(
        (e) => conceptIdSet.has(e.fromConceptId) && conceptIdSet.has(e.toConceptId)
      );

      const center = concepts.find((c) => c.id === conceptId);
      if (!center) {
        sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
        return;
      }

      const titleById = new Map(concepts.map((c) => [c.id, c.title]));

      // Build prompt
      const neighborLines: string[] = [];
      for (const c of concepts) {
        if (c.id === conceptId) continue;
        const outEdges = internalEdges
          .filter((e) => e.fromConceptId === c.id || e.toConceptId === c.id)
          .map((e) => {
            const from = titleById.get(e.fromConceptId) ?? e.fromConceptId;
            const to = titleById.get(e.toConceptId) ?? e.toConceptId;
            return `${from} -[${e.type}]-> ${to}`;
          });
        neighborLines.push(
          `- ${c.title}${c.l0 ? `: ${c.l0}` : ""}${outEdges.length > 0 ? `\n  Edges: ${outEdges.join("; ")}` : ""}`
        );
      }

      const prompt = [
        "You are a knowledge graph tutor. Given a concept and its subgraph neighborhood, synthesize a rich context that explains what the concept is, how it relates to its neighbors, and why it matters.",
        "",
        `Concept: ${center.title}`,
        center.l0 ? `Definition: ${center.l0}` : "",
        center.l1.length > 0 ? `Key points:\n${center.l1.map((b) => `- ${b}`).join("\n")}` : "",
        "",
        neighborLines.length > 0
          ? `Neighbors:\n${neighborLines.join("\n")}`
          : "(No neighbors)",
        "",
        "Write 2-4 paragraphs synthesizing this concept in its graph context. Be specific and reference the neighboring concepts by name."
      ]
        .filter(Boolean)
        .join("\n");

      const client = createOpenAIResponsesClient();
      const model = resolveModel("mini");

      const { data } = await runStructuredOutput<{ context: string }>(client, {
        model,
        input: prompt,
        spec: {
          name: "concept_context",
          schema: {
            type: "object",
            properties: {
              context: { type: "string" }
            },
            required: ["context"],
            additionalProperties: false
          }
        }
      });

      const updated = await deps.repos.concept.updateContext(conceptId, data.context);
      if (!updated) {
        sendError(reply, 404, "NOT_FOUND", "Concept not found after update", { id: conceptId });
        return;
      }

      const validated = parseOr400(reply, PostGenerateConceptContextResponseSchema, {
        concept: updated
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "GENERATE_CONTEXT_FAILED",
        err instanceof Error ? err.message : "Context generation failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/context", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostUpdateConceptContextRequestSchema, req.body);
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const updated = await deps.repos.concept.updateContext(conceptId, body.context);
    if (!updated) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    const validated = parseOr400(reply, PostUpdateConceptContextResponseSchema, {
      concept: updated
    });
    if (!validated) return;
    return validated;
  });

  app.post("/concept/:id/source", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostConceptSourceRequestSchema, req.body);
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    let source = await deps.repos.source.getByUrl(body.url);
    if (!source) {
      try {
        source = await deps.repos.source.create({ url: body.url, title: body.title ?? null });
      } catch {
        source = await deps.repos.source.getByUrl(body.url);
      }
    }

    if (!source) {
      sendError(reply, 400, "SOURCE_CREATE_FAILED", "Failed to create or fetch source");
      return;
    }

    try {
      await deps.repos.conceptSource.attach(conceptId, source.id);
      const validated = parseOr400(reply, PostConceptSourceResponseSchema, { source });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 400, "SOURCE_ATTACH_FAILED", "Failed to attach source to concept");
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/source/local", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostConceptLocalSourceRequestSchema, req.body ?? {});
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    const title = body.title ?? `${concept.title} notes`;
    const fileName = `source_${crypto.randomUUID()}.md`;
    const url = `vault://sources/${fileName}`;

    try {
      resolveVaultUrlToPath(url);
    } catch (err) {
      sendError(
        reply,
        500,
        "VAULT_PATH_INVALID",
        err instanceof Error ? err.message : "Invalid vault path"
      );
      return;
    }

    const initial = `# ${title}\n\n`;

    try {
      await writeVaultTextFileAtomic(url, initial);
    } catch (err) {
      sendError(reply, 500, "VAULT_WRITE_FAILED", "Failed to write local source file");
      app.log.error(err);
      return;
    }

    let source;
    try {
      source = await deps.repos.source.create({ url, title });
    } catch (err) {
      sendError(reply, 500, "SOURCE_CREATE_FAILED", "Failed to create local source");
      app.log.error(err);
      return;
    }

    try {
      await deps.repos.conceptSource.attach(conceptId, source.id);
    } catch (err) {
      sendError(reply, 500, "SOURCE_ATTACH_FAILED", "Failed to attach local source to concept");
      app.log.error(err);
      return;
    }

    const validated = parseOr400(reply, PostConceptLocalSourceResponseSchema, { source });
    if (!validated) return;
    return validated;
  });

  // --- Concept Note ---

  app.get("/concept/:id/note", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    if (!concept.noteSourceId) {
      const validated = parseOr400(reply, GetConceptNoteResponseSchema, { source: null, content: "" });
      if (!validated) return;
      return validated;
    }

    const source = await deps.repos.source.getById(concept.noteSourceId);
    if (!source) {
      const validated = parseOr400(reply, GetConceptNoteResponseSchema, { source: null, content: "" });
      if (!validated) return;
      return validated;
    }

    try {
      const content = await readVaultTextFile(source.url);
      const validated = parseOr400(reply, GetConceptNoteResponseSchema, { source, content });
      if (!validated) return;
      return validated;
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code.includes("ENOENT")) {
        const validated = parseOr400(reply, GetConceptNoteResponseSchema, { source, content: "" });
        if (!validated) return;
        return validated;
      }
      sendError(reply, 500, "VAULT_READ_FAILED", "Failed to read note file");
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/note", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostConceptNoteRequestSchema, req.body ?? {});
    if (!body) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    // Idempotent: if note already exists, return it
    if (concept.noteSourceId) {
      const existing = await deps.repos.source.getById(concept.noteSourceId);
      if (existing) {
        const validated = parseOr400(reply, PostConceptNoteResponseSchema, { source: existing });
        if (!validated) return;
        return validated;
      }
    }

    const title = body.title ?? `${concept.title} notes`;
    const fileName = `note_${conceptId}.md`;
    const url = `vault://notes/${fileName}`;

    try {
      resolveVaultUrlToPath(url);
    } catch (err) {
      sendError(
        reply,
        500,
        "VAULT_PATH_INVALID",
        err instanceof Error ? err.message : "Invalid vault path"
      );
      return;
    }

    const initial = `# ${concept.title}\n\n`;

    try {
      await writeVaultTextFileAtomic(url, initial);
    } catch (err) {
      sendError(reply, 500, "VAULT_WRITE_FAILED", "Failed to write note file");
      app.log.error(err);
      return;
    }

    let source;
    try {
      source = await deps.repos.source.create({ url, title });
    } catch (err) {
      sendError(reply, 500, "SOURCE_CREATE_FAILED", "Failed to create note source");
      app.log.error(err);
      return;
    }

    try {
      await deps.repos.concept.update({ id: conceptId, noteSourceId: source.id });
    } catch (err) {
      sendError(reply, 500, "CONCEPT_UPDATE_FAILED", "Failed to link note to concept");
      app.log.error(err);
      return;
    }

    try {
      await deps.repos.conceptSource.attach(conceptId, source.id);
    } catch {
      // non-critical — note is already linked via FK
    }

    const validated = parseOr400(reply, PostConceptNoteResponseSchema, { source });
    if (!validated) return;
    return validated;
  });

  app.get("/concept/:id/backlinks", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const concept = await deps.repos.concept.getById(conceptId);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: conceptId });
      return;
    }

    const backlinks = await deps.repos.concept.listBacklinkConcepts(concept.title);
    const filtered = backlinks.filter((c) => c.id !== conceptId);

    const validated = parseOr400(reply, GetConceptBacklinksResponseSchema, { concepts: filtered });
    if (!validated) return;
    return validated;
  });

  app.get("/source/:id/content", async (req, reply) => {
    const params = parseOr400(reply, GetSourceParamsSchema, req.params);
    if (!params) return;

    const source = await deps.repos.source.getById(params.id);
    if (!source) {
      sendError(reply, 404, "NOT_FOUND", "Source not found", { id: params.id });
      return;
    }

    if (!isVaultUrl(source.url)) {
      sendError(reply, 400, "NOT_LOCAL_SOURCE", "Source is not a local vault file", {
        id: params.id
      });
      return;
    }

    try {
      const content = await readVaultTextFile(source.url);
      const validated = parseOr400(reply, GetSourceContentResponseSchema, { source, content });
      if (!validated) return;
      return validated;
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code.includes("ENOENT")) {
        sendError(reply, 404, "SOURCE_FILE_MISSING", "Local source file not found", {
          id: params.id
        });
        return;
      }
      sendError(reply, 500, "VAULT_READ_FAILED", "Failed to read local source file");
      app.log.error(err);
      return;
    }
  });

  app.post("/source/:id/content", async (req, reply) => {
    const params = parseOr400(reply, GetSourceParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostSourceContentRequestSchema, req.body ?? {});
    if (!body) return;

    let source = await deps.repos.source.getById(params.id);
    if (!source) {
      sendError(reply, 404, "NOT_FOUND", "Source not found", { id: params.id });
      return;
    }

    if (!isVaultUrl(source.url)) {
      sendError(reply, 400, "NOT_LOCAL_SOURCE", "Source is not a local vault file", {
        id: params.id
      });
      return;
    }

    try {
      resolveVaultUrlToPath(source.url);
    } catch (err) {
      sendError(
        reply,
        400,
        "VAULT_PATH_INVALID",
        err instanceof Error ? err.message : "Invalid vault path"
      );
      return;
    }

    try {
      await writeVaultTextFileAtomic(source.url, body.content);
    } catch (err) {
      sendError(reply, 500, "VAULT_WRITE_FAILED", "Failed to write local source file");
      app.log.error(err);
      return;
    }

    const maybeTitle = titleFromMarkdown(body.content);
    if (maybeTitle && maybeTitle !== source.title) {
      try {
        source = await deps.repos.source.updateTitle(source.id, maybeTitle);
      } catch (err) {
        sendError(reply, 500, "SOURCE_UPDATE_FAILED", "Failed to update source title");
        app.log.error(err);
        return;
      }
    }

    const contentHash = sha256Hex(body.content);
    await deps.repos.sourceContent.upsert({
      sourceId: source.id,
      content: body.content,
      contentHash,
      contentType: "text/markdown"
    });

    const chunkSpecs = chunkText(body.content);
    await deps.repos.chunk.deleteBySourceId(source.id);
    for (const c of chunkSpecs) {
      await deps.repos.chunk.create({
        sourceId: source.id,
        content: c.content,
        startOffset: c.startOffset,
        endOffset: c.endOffset
      });
    }

    const validated = parseOr400(reply, PostSourceContentResponseSchema, {
      source,
      contentHash,
      chunkCount: chunkSpecs.length
    });
    if (!validated) return;
    return validated;
  });

  app.post("/concept", async (req, reply) => {
    const body = parseOr400(reply, PostConceptRequestSchema, req.body);
    if (!body) return;

    if ("id" in body) {
      const conceptId = await resolveConceptId(deps.repos, body.id);
      if (!conceptId) {
        sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: body.id });
        return;
      }

      await deps.repos.concept.update({ ...body, id: conceptId });
      const updated = await deps.repos.concept.getById(conceptId);
      if (!updated) {
        sendError(reply, 500, "INTERNAL", "Failed to load updated concept");
        return;
      }

      graphCache.invalidate();
      const validated = parseOr400(reply, PostConceptResponseSchema, { concept: updated });
      if (!validated) return;
      return validated;
    }

    const isDuplicate = await rejectIfDuplicateConcept(reply, deps.repos, {
      title: body.title,
      kind: body.kind,
      module: body.module ?? null
    });
    if (isDuplicate) return;

    const created = await deps.repos.concept.create(body);
    graphCache.invalidate();
    const validated = parseOr400(reply, PostConceptResponseSchema, { concept: created });
    if (!validated) return;
    return validated;
  });

  app.post("/concept/:id/distill", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    let llm: DistillLlm;
    try {
      llm = deps.distillLlm ?? createOpenAiDistillLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Distillation LLM not configured"
      );
      return;
    }

    try {
      const revision = await runDistillJob({
        repos: deps.repos,
        llm,
        conceptId
      });
      const validated = parseOr400(reply, PostConceptDistillResponseSchema, { revision });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 500, "DISTILL_FAILED", err instanceof Error ? err.message : "Distill failed");
      app.log.error(err);
      return;
    }
  });

  app.get("/concept/:id/draft-revisions", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const revisions = await deps.repos.draftRevision.listByConceptId(conceptId, 50);
    const validated = parseOr400(reply, GetConceptDraftRevisionsResponseSchema, { revisions });
    if (!validated) return;
    return validated;
  });

  app.post("/concept/:id/draft-revisions/:revisionId/apply", async (req, reply) => {
    const params = parseOr400(reply, ConceptDraftRevisionParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const revision = await deps.repos.draftRevision.getById(params.revisionId);
    if (!revision || revision.conceptId !== conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Draft revision not found", {
        id: params.revisionId
      });
      return;
    }

    try {
      const res = await deps.repos.draftRevision.apply(params.revisionId);
      const validated = parseOr400(reply, PostDraftRevisionApplyResponseSchema, {
        concept: res.concept,
        revision: res.revision
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("CONFLICT:")) {
        sendError(reply, 409, "CONFLICT", message, { id: params.revisionId });
        return;
      }
      if (message.includes("not in draft status")) {
        sendError(reply, 409, "REVISION_NOT_DRAFT", message, { id: params.revisionId });
        return;
      }
      sendError(reply, 400, "APPLY_FAILED", message, { id: params.revisionId });
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/draft-revisions/:revisionId/reject", async (req, reply) => {
    const params = parseOr400(reply, ConceptDraftRevisionParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const revision = await deps.repos.draftRevision.getById(params.revisionId);
    if (!revision || revision.conceptId !== conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Draft revision not found", {
        id: params.revisionId
      });
      return;
    }

    try {
      const rejected = await deps.repos.draftRevision.reject(params.revisionId);
      const validated = parseOr400(reply, PostDraftRevisionRejectResponseSchema, {
        revision: rejected
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not in draft status")) {
        sendError(reply, 409, "REVISION_NOT_DRAFT", message, { id: params.revisionId });
        return;
      }
      sendError(reply, 400, "REJECT_FAILED", message, { id: params.revisionId });
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/:id/draft-revisions/:revisionId/revert", async (req, reply) => {
    const params = parseOr400(reply, ConceptDraftRevisionParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const revision = await deps.repos.draftRevision.getById(params.revisionId);
    if (!revision || revision.conceptId !== conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Draft revision not found", {
        id: params.revisionId
      });
      return;
    }

    try {
      const res = await deps.repos.draftRevision.revert(params.revisionId);
      const validated = parseOr400(reply, PostDraftRevisionRevertResponseSchema, {
        concept: res.concept,
        revision: res.revision
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("CONFLICT:")) {
        sendError(reply, 409, "CONFLICT", message, { id: params.revisionId });
        return;
      }
      if (message.includes("Only applied")) {
        sendError(reply, 409, "REVISION_NOT_APPLIED", message, { id: params.revisionId });
        return;
      }
      sendError(reply, 400, "REVERT_FAILED", message, { id: params.revisionId });
      app.log.error(err);
      return;
    }
  });

  app.post("/changeset/edge-draft", async (req, reply) => {
    const body = parseOr400(reply, PostDraftEdgeRequestSchema, req.body);
    if (!body) return;

    const fromId = await resolveConceptId(deps.repos, body.fromConceptId);
    if (!fromId) {
      sendError(reply, 404, "NOT_FOUND", "fromConceptId not found", { id: body.fromConceptId });
      return;
    }

    const toId = await resolveConceptId(deps.repos, body.toConceptId);
    if (!toId) {
      sendError(reply, 404, "NOT_FOUND", "toConceptId not found", { id: body.toConceptId });
      return;
    }

    if (fromId === toId) {
      sendError(reply, 400, "EDGE_SELF_LOOP", "fromConceptId and toConceptId must differ");
      return;
    }

    if (body.type === "PREREQUISITE_OF") {
      const allEdges = await deps.repos.edge.listSummaries();
      const check = wouldCreatePrereqCycle({
        fromConceptId: fromId,
        toConceptId: toId,
        existingEdges: allEdges
      });
      if (check.wouldCycle) {
        sendError(
          reply,
          409,
          "EDGE_WOULD_CYCLE",
          "Adding this edge would create a cycle in the prerequisite chain"
        );
        return;
      }
    }

    try {
      const changeset = await deps.repos.changeset.create({ status: "draft" });
      await deps.repos.changesetItem.create({
        changesetId: changeset.id,
        entityType: "edge",
        action: "create",
        status: "pending",
        payload: {
          fromConceptId: fromId,
          toConceptId: toId,
          type: body.type,
          sourceUrl: body.sourceUrl ?? null,
          confidence: body.confidence ?? null,
          verifierScore: body.verifierScore ?? null,
          evidenceChunkIds: body.evidenceChunkIds
        }
      });

      const [item] = await deps.repos.changesetItem.listByChangesetId(changeset.id);
      if (!item) {
        sendError(reply, 500, "CHANGESET_ITEM_CREATE_FAILED", "Failed to stage draft edge");
        return;
      }

      const validated = parseOr400(reply, PostDraftEdgeResponseSchema, {
        changeset,
        item
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 400, "CHANGESET_CREATE_FAILED", "Failed to stage draft edge");
      app.log.error(err);
      return;
    }
  });

  app.post("/edge", async (req, reply) => {
    const body = parseOr400(reply, PostEdgeRequestSchema, req.body);
    if (!body) return;

    const fromId = await resolveConceptId(deps.repos, body.fromConceptId);
    if (!fromId) {
      sendError(reply, 404, "NOT_FOUND", "fromConceptId not found", { id: body.fromConceptId });
      return;
    }

    const toId = await resolveConceptId(deps.repos, body.toConceptId);
    if (!toId) {
      sendError(reply, 404, "NOT_FOUND", "toConceptId not found", { id: body.toConceptId });
      return;
    }

    try {
      if (fromId === toId) {
        sendError(reply, 400, "EDGE_SELF_LOOP", "fromConceptId and toConceptId must differ");
        return;
      }

      if (body.type === "PREREQUISITE_OF") {
        const allEdges = await deps.repos.edge.listSummaries();
        const check = wouldCreatePrereqCycle({
          fromConceptId: fromId,
          toConceptId: toId,
          existingEdges: allEdges
        });
        if (check.wouldCycle) {
          sendError(reply, 409, "EDGE_WOULD_CYCLE",
            "Adding this edge would create a cycle in the prerequisite chain");
          return;
        }
      }

      const edge = await deps.repos.edge.create({
        ...body,
        fromConceptId: fromId,
        toConceptId: toId
      });
      graphCache.invalidate();
      const validated = parseOr400(reply, PostEdgeResponseSchema, { edge });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 400, "EDGE_CREATE_FAILED", "Failed to create edge");
      app.log.error(err);
      return;
    }
  });

  app.get("/edge/:id/evidence", async (req, reply) => {
    const params = parseOr400(reply, GetEdgeParamsSchema, req.params);
    if (!params) return;

    const edge = await deps.repos.edge.getById(params.id);
    if (!edge) {
      sendError(reply, 404, "NOT_FOUND", "Edge not found", { id: params.id });
      return;
    }

    const evidence = await deps.repos.edge.listEvidence(params.id);
    const validated = parseOr400(reply, GetEdgeEvidenceResponseSchema, { edge, evidence });
    if (!validated) return;
    return validated;
  });

  app.get("/search", async (req, reply) => {
    const query = parseOr400(reply, SearchQuerySchema, req.query);
    if (!query) return;

    const q = query.q.trim();
    const limit = query.limit ?? 20;

    if (!q) {
      if (query.mode === "exact") {
        const validated = parseOr400(reply, SearchExactResponseSchema, { results: [] });
        if (!validated) return;
        return validated;
      }
      const validated = parseOr400(reply, SearchResponseSchema, { results: [] });
      if (!validated) return;
      return validated;
    }

    if (query.mode === "exact") {
      const results = await deps.repos.concept.searchExact(q, limit);
      const validated = parseOr400(reply, SearchExactResponseSchema, { results });
      if (!validated) return;
      return validated;
    }

    const results = await deps.repos.concept.searchSummaries(q, limit);
    const validated = parseOr400(reply, SearchResponseSchema, { results });
    if (!validated) return;
    return validated;
  });

  app.get("/search/universal", async (req, reply) => {
    const query = parseOr400(reply, SearchUniversalQuerySchema, req.query);
    if (!query) return;

    const q = query.q.trim();
    if (!q) {
      const validated = parseOr400(reply, SearchUniversalResponseSchema, {
        concepts: [],
        sources: [],
        evidence: []
      });
      if (!validated) return;
      return validated;
    }

    const limit = query.limit ?? 10;

    const [concepts, sourcesRaw, evidenceRaw] = await Promise.all([
      deps.repos.concept.searchExact(q, limit),
      deps.repos.source.searchExact(q, limit),
      deps.repos.chunk.searchEvidenceExact(q, limit)
    ]);

    const sourceConceptIds = await deps.repos.conceptSource.listConceptIdsBySourceIds(
      sourcesRaw.map((s) => s.id)
    );

    const chunkConceptIds = await deps.repos.chunk.listConceptIdsByChunkIds(
      evidenceRaw.map((e) => e.chunk.id)
    );

    const sources = sourcesRaw.map((s) => ({
      source: { id: s.id, url: s.url, title: s.title, createdAt: s.createdAt },
      rank: s.rank,
      titleHighlight: s.titleHighlight,
      snippetHighlight: s.snippetHighlight,
      conceptIds: sourceConceptIds.get(s.id) ?? []
    }));

    const evidence = evidenceRaw.map((e) => ({
      chunk: e.chunk,
      rank: e.rank,
      snippetHighlight: e.snippetHighlight,
      conceptIds: chunkConceptIds.get(e.chunk.id) ?? []
    }));

    const validated = parseOr400(reply, SearchUniversalResponseSchema, {
      concepts,
      sources,
      evidence
    });
    if (!validated) return;
    return validated;
  });

  app.post("/concept/merge/preview", async (req, reply) => {
    const body = parseOr400(reply, PostConceptMergePreviewRequestSchema, req.body);
    if (!body) return;

    const canonicalId = await resolveConceptId(deps.repos, body.canonicalId);
    if (!canonicalId) {
      sendError(reply, 404, "NOT_FOUND", "Canonical concept not found", { id: body.canonicalId });
      return;
    }

    try {
      const preview = await deps.repos.conceptMerge.preview({
        canonicalId,
        duplicateIds: body.duplicateIds
      });
      const validated = parseOr400(reply, PostConceptMergePreviewResponseSchema, preview);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        400,
        "MERGE_PREVIEW_FAILED",
        err instanceof Error ? err.message : "Merge preview failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/merge/apply", async (req, reply) => {
    const body = parseOr400(reply, PostConceptMergeApplyRequestSchema, req.body);
    if (!body) return;

    const canonicalId = await resolveConceptId(deps.repos, body.canonicalId);
    if (!canonicalId) {
      sendError(reply, 404, "NOT_FOUND", "Canonical concept not found", { id: body.canonicalId });
      return;
    }

    try {
      const merge = await deps.repos.conceptMerge.apply({
        canonicalId,
        duplicateIds: body.duplicateIds
      });
      graphCache.invalidate();
      const validated = parseOr400(reply, PostConceptMergeApplyResponseSchema, { merge });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        400,
        "MERGE_FAILED",
        err instanceof Error ? err.message : "Merge failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/concept/merge/:id/undo", async (req, reply) => {
    const params = parseOr400(reply, ConceptMergeParamsSchema, req.params);
    if (!params) return;

    try {
      const merge = await deps.repos.conceptMerge.undo(params.id);
      const validated = parseOr400(reply, PostConceptMergeUndoResponseSchema, { merge });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Undo failed";
      if (message.startsWith("Merge not found")) {
        sendError(reply, 404, "NOT_FOUND", "Merge not found", { id: params.id });
        return;
      }
      if (message.includes("already been undone")) {
        sendError(reply, 409, "MERGE_UNDONE", message, { id: params.id });
        return;
      }
      sendError(reply, 400, "UNDO_FAILED", message, { id: params.id });
      app.log.error(err);
      return;
    }
  });

  app.get("/concept/:id/merges", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const conceptId = await resolveConceptId(deps.repos, params.id);
    if (!conceptId) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const merges = await deps.repos.conceptMerge.listByCanonicalId(conceptId, 50);
    const validated = parseOr400(reply, GetConceptMergesResponseSchema, { merges });
    if (!validated) return;
    return validated;
  });

  app.get("/changesets", async (_req, reply) => {
    const changesets = await deps.repos.changeset.list();
    const validated = parseOr400(reply, GetChangesetsResponseSchema, { changesets });
    if (!validated) return;
    return validated;
  });

  app.get("/changeset/:id", async (req, reply) => {
    const params = parseOr400(reply, GetChangesetParamsSchema, req.params);
    if (!params) return;

    const changeset = await deps.repos.changeset.getById(params.id);
    if (!changeset) {
      sendError(reply, 404, "NOT_FOUND", "Changeset not found", { id: params.id });
      return;
    }

    const items = await deps.repos.changesetItem.listByChangesetId(params.id);
    const evidenceChunkIdSet = new Set<string>();
    for (const item of items) {
      if (typeof item.payload !== "object" || item.payload === null) continue;
      const payload = item.payload as Record<string, unknown>;
      for (const id of toStringArray(payload.evidenceChunkIds)) {
        if (id.trim()) evidenceChunkIdSet.add(id);
      }
    }
    const evidenceChunks = await deps.repos.chunk.listEvidenceByIds([...evidenceChunkIdSet]);

    const validated = parseOr400(reply, GetChangesetResponseSchema, {
      changeset,
      items,
      evidenceChunks
    });
    if (!validated) return;
    return validated;
  });

  app.post("/changeset/:id/status", async (req, reply) => {
    const params = parseOr400(reply, GetChangesetParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostChangesetStatusRequestSchema, req.body);
    if (!body) return;

    try {
      const changeset = await deps.repos.changeset.updateStatus(params.id, body.status);
      const validated = parseOr400(reply, PostChangesetStatusResponseSchema, { changeset });
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("Changeset not found")) {
        sendError(reply, 404, "NOT_FOUND", "Changeset not found", { id: params.id });
        return;
      }
      if (message.includes("applied changeset")) {
        sendError(reply, 409, "CHANGESET_APPLIED", message, { id: params.id });
        return;
      }
      sendError(reply, 400, "STATUS_UPDATE_FAILED", message, { id: params.id });
      app.log.error(err);
      return;
    }
  });

  app.post("/changeset/:id/undo", async (req, reply) => {
    const params = parseOr400(reply, GetChangesetParamsSchema, req.params);
    if (!params) return;

    sendError(reply, 501, "UNDO_NOT_IMPLEMENTED", "Undo is not available yet", {
      id: params.id
    });
  });

  app.post("/changeset-item/:id/status", async (req, reply) => {
    const params = parseOr400(reply, ChangesetItemParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostChangesetItemStatusRequestSchema, req.body);
    if (!body) return;

    const existing = await deps.repos.changesetItem.getById(params.id);
    if (!existing) {
      sendError(reply, 404, "NOT_FOUND", "Changeset item not found", { id: params.id });
      return;
    }
    if (existing.status === "applied") {
      sendError(reply, 409, "ITEM_APPLIED", "Cannot change status of an applied item", {
        id: params.id
      });
      return;
    }

    try {
      const item = await deps.repos.changesetItem.updateStatus(params.id, body.status);
      const validated = parseOr400(reply, PostChangesetItemStatusResponseSchema, { item });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 400, "STATUS_UPDATE_FAILED", "Failed to update item status");
      app.log.error(err);
      return;
    }
  });

  app.post("/changeset/:id/apply", async (req, reply) => {
    const params = parseOr400(reply, GetChangesetParamsSchema, req.params);
    if (!params) return;

    const allItems = await deps.repos.changesetItem.listByChangesetId(params.id);
    const acceptedFilePatches = allItems.filter(
      (i) => i.status === "accepted" && i.entityType === "file" && i.action === "patch"
    );

    let rollbackFilePatches: (() => Promise<void>) | null = null;
    let filePatchOptions: ApplyAcceptedOptions = {};

    try {
      if (acceptedFilePatches.length > 0) {
        const vaultRoot = deps.vaultRoot;
        if (!vaultRoot) {
          sendError(
            reply,
            501,
            "VAULT_NOT_CONFIGURED",
            "vaultRoot is required to apply file patches"
          );
          return;
        }

        const applied = await applyAcceptedFilePatchItemsToVault({
          vaultRoot,
          items: acceptedFilePatches.map((i) => ({ id: i.id, payload: i.payload }))
        });
        rollbackFilePatches = applied.rollback;
        filePatchOptions = {
          appliedFilePatchItemIds: applied.appliedItemIds,
          vaultFileUpdates: applied.vaultFileUpdates
        };
      }

      const res = await deps.repos.changeset.applyAccepted(params.id, filePatchOptions);
      graphCache.invalidate();
      const validated = parseOr400(reply, PostApplyChangesetResponseSchema, {
        changeset: res.changeset,
        applied: {
          conceptIds: res.appliedConceptIds,
          edgeIds: res.appliedEdgeIds
        }
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      if (rollbackFilePatches) {
        await rollbackFilePatches();
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("Changeset not found")) {
        sendError(reply, 404, "NOT_FOUND", "Changeset not found", { id: params.id });
        return;
      }
      if (message.includes("already applied")) {
        sendError(reply, 409, "CHANGESET_APPLIED", "Changeset already applied", { id: params.id });
        return;
      }
      if (message.includes("is rejected")) {
        sendError(reply, 409, "CHANGESET_REJECTED", "Changeset is rejected", { id: params.id });
        return;
      }
      sendError(reply, 400, "APPLY_FAILED", message);
      app.log.error(err);
      return;
    }
  });

  app.get("/review/due", async (req, reply) => {
    const query = parseOr400(reply, GetReviewDueQuerySchema, req.query ?? {});
    if (!query) return;

    const limit = query.limit ?? 20;
    const due = await deps.repos.reviewItem.listDue(Date.now(), limit);

    const payload = {
      items: due
        .filter((item) => item.conceptId !== null)
        .map((item) => ({
          id: item.id,
          conceptId: item.conceptId as string,
          type: item.type,
          prompt: item.prompt,
          answer: item.answer,
          rubric: item.rubric,
          status: item.status,
          dueAt: item.dueAt,
          ease: item.ease,
          interval: item.interval,
          reps: item.reps,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
    };

    const validated = parseOr400(reply, GetReviewDueResponseSchema, payload);
    if (!validated) return;
    return validated;
  });

  app.post("/review/:id/grade", async (req, reply) => {
    const params = parseOr400(reply, ReviewItemParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostReviewGradeRequestSchema, req.body);
    if (!body) return;

    try {
      const item = await deps.repos.reviewItem.grade({ id: params.id, grade: body.grade });
      if (!item.conceptId) {
        sendError(reply, 400, "INVALID_ITEM", "Review item is missing conceptId", {
          id: params.id
        });
        return;
      }

      const payload = {
        item: {
          id: item.id,
          conceptId: item.conceptId,
          type: item.type,
          prompt: item.prompt,
          answer: item.answer,
          rubric: item.rubric,
          status: item.status,
          dueAt: item.dueAt,
          ease: item.ease,
          interval: item.interval,
          reps: item.reps,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }
      };

      const validated = parseOr400(reply, PostReviewGradeResponseSchema, payload);
      if (!validated) return;
      return validated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("Review item not found")) {
        sendError(reply, 404, "NOT_FOUND", "Review item not found", { id: params.id });
        return;
      }
      if (message.includes("not active")) {
        sendError(reply, 409, "NOT_ACTIVE", "Review item is not active", { id: params.id });
        return;
      }
      if (message.includes("missing conceptId")) {
        sendError(reply, 400, "INVALID_ITEM", "Review item is missing conceptId", {
          id: params.id
        });
        return;
      }
      sendError(reply, 400, "GRADE_FAILED", message, { id: params.id });
      app.log.error(err);
      return;
    }
  });

  app.post("/tutor", async (req, reply) => {
    const body = parseOr400(reply, PostTutorRequestSchema, req.body);
    if (!body) return;

    try {
      const llm: TutorLlm = deps.tutorLlm ?? createOpenAiTutorLlm();
      const res = await runTutorJob({
        repos: deps.repos,
        llm,
        question: body.question
      });
      const validated = parseOr400(reply, PostTutorResponseSchema, res);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 500, "TUTOR_FAILED", err instanceof Error ? err.message : "Tutor failed");
      app.log.error(err);
      return;
    }
  });

  app.post("/capture", async (req, reply) => {
    const body = parseOr400(reply, PostCaptureRequestSchema, req.body);
    if (!body) return;

    let llm: CaptureLlm;
    try {
      llm = deps.captureLlm ?? createOpenAiCaptureLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Capture LLM not configured"
      );
      return;
    }

    try {
      const res = await runCaptureJob({
        repos: deps.repos,
        llm,
        text: body.text
      });
      const validated = parseOr400(reply, PostCaptureResponseSchema, res);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        502,
        "CAPTURE_FAILED",
        err instanceof Error ? err.message : "Capture failed"
      );
      app.log.error(err);
      return;
    }
  });

  // --- Training session routes ---

  app.post("/training/session", async (req, reply) => {
    const body = parseOr400(reply, PostCreateTrainingSessionRequestSchema, req.body ?? {});
    if (!body) return;

    let llm: TrainingLlm;
    try {
      llm = deps.trainingLlm ?? createOpenAiTrainingLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Training LLM not configured"
      );
      return;
    }

    try {
      // Pick concepts: from request or low-mastery
      let conceptIds = body.conceptIds;
      if (!conceptIds || conceptIds.length === 0) {
        // Pick up to 3 low-mastery concepts
        const allConcepts = await deps.repos.concept.listSummaries();
        const sorted = allConcepts
          .filter((c) => typeof c.masteryScore === "number")
          .sort((a, b) => a.masteryScore - b.masteryScore);
        conceptIds = sorted.slice(0, 3).map((c) => c.id);
      }

      if (conceptIds.length === 0) {
        sendError(reply, 400, "NO_CONCEPTS", "No concepts available for training");
        return;
      }

      // For each concept, generate training questions
      const allQuestions: Array<{
        conceptId: string;
        spec: { type: string; prompt: string; answer: unknown; rubric: unknown };
      }> = [];

      for (const conceptId of conceptIds) {
        const concept = await deps.repos.concept.getById(conceptId);
        if (!concept) continue;

        // Get neighbor concepts for CONTRAST_EXPLAIN
        const edges = await deps.repos.edge.listSummariesByConceptIds([conceptId], 20);
        const neighborIds = new Set<string>();
        for (const e of edges) {
          if (e.fromConceptId !== conceptId) neighborIds.add(e.fromConceptId);
          if (e.toConceptId !== conceptId) neighborIds.add(e.toConceptId);
        }

        const candidates: Array<{ id: string; title: string }> = [];
        for (const nid of neighborIds) {
          const n = await deps.repos.concept.getById(nid);
          if (n) candidates.push({ id: n.id, title: n.title });
          if (candidates.length >= 5) break;
        }

        const count = Math.max(2, Math.ceil(6 / conceptIds.length));
        const specs = await generateTrainingQuestions({
          concept: {
            id: concept.id,
            title: concept.title,
            l0: concept.l0,
            l1: concept.l1,
            module: concept.module
          },
          candidateConcepts: candidates,
          count,
          llm
        });

        for (const spec of specs) {
          allQuestions.push({ conceptId: concept.id, spec });
        }
      }

      // Create review items + session + session items
      const session = await deps.repos.trainingSession.create({
        conceptIds,
        questionCount: allQuestions.length
      });

      const reviewItems: Array<{ id: string; type: string; prompt: string; answer: unknown; rubric: unknown; conceptId: string }> = [];
      const sessionItems: Array<{ id: string; sessionId: string; reviewItemId: string; position: number; userAnswer: string | null; grade: string | null; feedback: string | null; gradedAt: number | null; createdAt: number }> = [];

      for (let i = 0; i < allQuestions.length; i++) {
        const q = allQuestions[i]!;
        const riId = `review_item_${crypto.randomUUID()}`;
        await deps.repos.reviewItem.create({
          id: riId,
          conceptId: q.conceptId,
          type: q.spec.type,
          prompt: q.spec.prompt,
          answer: q.spec.answer,
          rubric: q.spec.rubric,
          status: "active",
          dueAt: Date.now()
        });

        const ri = await deps.repos.reviewItem.getById(riId);
        if (ri) {
          reviewItems.push({
            id: ri.id,
            type: ri.type,
            prompt: ri.prompt,
            answer: ri.answer,
            rubric: ri.rubric,
            conceptId: ri.conceptId ?? q.conceptId
          });
        }

        const si = await deps.repos.trainingSessionItem.create({
          sessionId: session.id,
          reviewItemId: riId,
          position: i
        });
        sessionItems.push(si);
      }

      const questions = reviewItems.map((ri) => {
        const now = Date.now();
        return {
          id: ri.id,
          conceptId: ri.conceptId,
          type: ri.type,
          prompt: ri.prompt,
          answer: ri.answer,
          rubric: ri.rubric,
          status: "active" as const,
          dueAt: now,
          ease: 2.5,
          interval: 0,
          reps: 0,
          createdAt: now,
          updatedAt: now
        };
      });

      const validated = parseOr400(reply, PostCreateTrainingSessionResponseSchema, {
        session,
        items: sessionItems,
        questions
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "TRAINING_SESSION_FAILED",
        err instanceof Error ? err.message : "Failed to create training session"
      );
      app.log.error(err);
      return;
    }
  });

  app.get("/training/session/:id", async (req, reply) => {
    const params = parseOr400(reply, TrainingSessionParamsSchema, req.params);
    if (!params) return;

    const session = await deps.repos.trainingSession.getById(params.id);
    if (!session) {
      sendError(reply, 404, "NOT_FOUND", "Training session not found");
      return;
    }

    const items = await deps.repos.trainingSessionItem.listBySessionId(params.id);

    const questions = [];
    for (const item of items) {
      const ri = await deps.repos.reviewItem.getById(item.reviewItemId);
      if (ri) {
        questions.push({
          id: ri.id,
          conceptId: ri.conceptId ?? "",
          type: ri.type,
          prompt: ri.prompt,
          answer: ri.answer,
          rubric: ri.rubric,
          status: ri.status,
          dueAt: ri.dueAt,
          ease: ri.ease,
          interval: ri.interval,
          reps: ri.reps,
          createdAt: ri.createdAt,
          updatedAt: ri.updatedAt
        });
      }
    }

    const validated = parseOr400(reply, GetTrainingSessionResponseSchema, {
      session,
      items,
      questions
    });
    if (!validated) return;
    return validated;
  });

  app.post("/training/session/:id/item/:itemId/submit", async (req, reply) => {
    const params = parseOr400(reply, TrainingSessionItemParamsSchema, req.params);
    if (!params) return;

    const body = parseOr400(reply, PostSubmitTrainingAnswerRequestSchema, req.body ?? {});
    if (!body) return;

    const session = await deps.repos.trainingSession.getById(params.id);
    if (!session) {
      sendError(reply, 404, "NOT_FOUND", "Training session not found");
      return;
    }
    if (session.status !== "active") {
      sendError(reply, 409, "SESSION_NOT_ACTIVE", "Training session is not active");
      return;
    }

    const sessionItem = await deps.repos.trainingSessionItem.getById(params.itemId);
    if (!sessionItem || sessionItem.sessionId !== params.id) {
      sendError(reply, 404, "NOT_FOUND", "Training session item not found");
      return;
    }

    const reviewItem = await deps.repos.reviewItem.getById(sessionItem.reviewItemId);
    if (!reviewItem) {
      sendError(reply, 404, "NOT_FOUND", "Review item not found");
      return;
    }

    let llm: TrainingLlm;
    try {
      llm = deps.trainingLlm ?? createOpenAiTrainingLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Training LLM not configured"
      );
      return;
    }

    try {
      const gradeResult = await gradeTrainingAnswer({
        questionType: reviewItem.type,
        prompt: reviewItem.prompt,
        answer: reviewItem.answer,
        rubric: reviewItem.rubric,
        userAnswer: body.answer,
        llm
      });

      const updatedItem = await deps.repos.trainingSessionItem.submitAnswer({
        id: params.itemId,
        userAnswer: body.answer,
        grade: gradeResult.grade,
        feedback: gradeResult.feedback
      });

      // Update SRS for the review item
      const reviewGrade = gradeResult.grade === "correct" ? "correct" : gradeResult.grade === "partial" ? "partial" : "wrong";
      await deps.repos.reviewItem.grade({
        id: reviewItem.id,
        grade: reviewGrade
      });

      // Update session counts
      const allItems = await deps.repos.trainingSessionItem.listBySessionId(params.id);
      const counts = { correctCount: 0, partialCount: 0, wrongCount: 0 };
      for (const it of allItems) {
        if (it.grade === "correct") counts.correctCount++;
        else if (it.grade === "partial") counts.partialCount++;
        else if (it.grade === "wrong") counts.wrongCount++;
      }
      await deps.repos.trainingSession.updateCounts(params.id, counts);

      const validated = parseOr400(reply, PostSubmitTrainingAnswerResponseSchema, {
        item: updatedItem,
        followUp: null
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "GRADING_FAILED",
        err instanceof Error ? err.message : "Failed to grade answer"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/training/session/:id/complete", async (req, reply) => {
    const params = parseOr400(reply, TrainingSessionParamsSchema, req.params);
    if (!params) return;

    const session = await deps.repos.trainingSession.getById(params.id);
    if (!session) {
      sendError(reply, 404, "NOT_FOUND", "Training session not found");
      return;
    }

    try {
      const completed = await deps.repos.trainingSession.complete(params.id);
      const validated = parseOr400(reply, PostCompleteTrainingSessionResponseSchema, {
        session: completed
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "COMPLETE_FAILED",
        err instanceof Error ? err.message : "Failed to complete session"
      );
      app.log.error(err);
      return;
    }
  });

  // --- Smart Add routes ---

  app.post("/smart-add/resolve", async (req, reply) => {
    const body = parseOr400(reply, PostSmartAddResolveRequestSchema, req.body);
    if (!body) return;

    let llm: SmartAddLlm;
    try {
      llm = deps.smartAddLlm ?? createOpenAiSmartAddLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Smart add LLM not configured"
      );
      return;
    }

    try {
      const hasDuplicate = await rejectIfDuplicateConcept(reply, deps.repos, {
        title: body.title
      });
      if (hasDuplicate) return;

      const res = await runSmartAddResolve({
        repos: deps.repos,
        llm,
        title: body.title
      });
      const validated = parseOr400(reply, PostSmartAddResolveResponseSchema, res);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        502,
        "SMART_ADD_RESOLVE_FAILED",
        err instanceof Error ? err.message : "Smart add resolve failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/smart-add/confirm", async (req, reply) => {
    const body = parseOr400(reply, PostSmartAddConfirmRequestSchema, req.body);
    if (!body) return;

    try {
      const hasDuplicate = await rejectIfDuplicateConcept(reply, deps.repos, {
        title: body.title,
        kind: body.kind,
        module: body.module
      });
      if (hasDuplicate) return;

      const created = await deps.repos.concept.create({
        title: body.title,
        kind: body.kind,
        l0: body.l0,
        l1: body.l1,
        module: body.module
      });

      let edgesCreated = 0;
      for (const edge of body.edges) {
        const fromId = edge.direction === "from" ? created.id : edge.existingConceptId;
        const toId = edge.direction === "from" ? edge.existingConceptId : created.id;
        if (fromId === toId) continue;

        await deps.repos.edge.create({
          fromConceptId: fromId,
          toConceptId: toId,
          type: edge.type
        });
        edgesCreated++;
      }

      graphCache.invalidate();

      const validated = parseOr400(reply, PostSmartAddConfirmResponseSchema, {
        concept: created,
        edgesCreated
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "SMART_ADD_CONFIRM_FAILED",
        err instanceof Error ? err.message : "Smart add confirm failed"
      );
      app.log.error(err);
      return;
    }
  });

  // --- Doc Ingest routes ---

  app.post("/doc-ingest/resolve", async (req, reply) => {
    const body = parseOr400(reply, PostDocIngestResolveRequestSchema, req.body);
    if (!body) return;

    let llm: DocIngestLlm;
    try {
      llm = deps.docIngestLlm ?? createOpenAiDocIngestLlm();
    } catch (err) {
      sendError(
        reply,
        501,
        "LLM_NOT_CONFIGURED",
        err instanceof Error ? err.message : "Doc ingest LLM not configured"
      );
      return;
    }

    try {
      const res = await runDocIngestResolve({
        repos: deps.repos,
        llm,
        document: body.document
      });
      const validated = parseOr400(reply, PostDocIngestResolveResponseSchema, res);
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        502,
        "DOC_INGEST_RESOLVE_FAILED",
        err instanceof Error ? err.message : "Doc ingest resolve failed"
      );
      app.log.error(err);
      return;
    }
  });

  app.post("/doc-ingest/confirm", async (req, reply) => {
    const body = parseOr400(reply, PostDocIngestConfirmRequestSchema, req.body);
    if (!body) return;

    try {
      let conceptsUpdated = 0;
      let conceptsCreated = 0;
      let edgesCreated = 0;
      for (const concept of body.acceptedNewConcepts) {
        const hasDuplicate = await rejectIfDuplicateConcept(reply, deps.repos, {
          title: concept.title,
          kind: concept.kind,
          module: concept.module
        });
        if (hasDuplicate) return;
      }

      // Apply accepted deltas
      for (const delta of body.acceptedDeltas) {
        const existing = body.resolvedDeltas.find((d) => d.conceptId === delta.conceptId);
        if (!existing) continue;

        const concept = await deps.repos.concept.getById(delta.conceptId);
        if (!concept) continue;

        const updates: { id: string; l0?: string | null; l1?: string[] } = { id: delta.conceptId };
        let changed = false;

        if (delta.applyL0 && existing.proposedL0 !== null) {
          updates.l0 = existing.proposedL0;
          changed = true;
        }

        if (delta.acceptedNewL1.length > 0) {
          updates.l1 = [...concept.l1, ...delta.acceptedNewL1];
          changed = true;
        }

        if (changed) {
          await deps.repos.concept.update(updates);
          conceptsUpdated++;
        }
      }

      // Create accepted new concepts and their edges
      for (const nc of body.acceptedNewConcepts) {
        const created = await deps.repos.concept.create({
          title: nc.title,
          l0: nc.l0,
          l1: nc.l1,
          kind: nc.kind,
          module: nc.module
        });
        conceptsCreated++;

        for (const edge of nc.edges) {
          const fromId = edge.direction === "from" ? created.id : edge.existingConceptId;
          const toId = edge.direction === "from" ? edge.existingConceptId : created.id;
          if (fromId === toId) continue;

          await deps.repos.edge.create({
            fromConceptId: fromId,
            toConceptId: toId,
            type: edge.type
          });
          edgesCreated++;
        }
      }

      graphCache.invalidate();

      const validated = parseOr400(reply, PostDocIngestConfirmResponseSchema, {
        conceptsUpdated,
        conceptsCreated,
        edgesCreated
      });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(
        reply,
        500,
        "DOC_INGEST_CONFIRM_FAILED",
        err instanceof Error ? err.message : "Doc ingest confirm failed"
      );
      app.log.error(err);
      return;
    }
  });
}

export function buildServer(deps: ServerDeps) {
  const app = Fastify({ logger: true });
  const crawlerAllowlistDomains = parseAllowlistDomains(process.env.CRAWLER_ALLOWLIST_DOMAINS);
  const graphCache = new GraphCache();

  app.get("/health", async () => ({ ok: true }));

  // SSE endpoint for live reindex events
  if (deps.reindexBus) {
    const bus = deps.reindexBus;

    const registerEventsRoute = (scope: FastifyInstance) => {
      scope.get("/events", async (req, reply) => {
        reply.raw.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive"
        });

        const onReindex = (conceptIds: string[]) => {
          const data = JSON.stringify({ type: "reindex", conceptIds });
          reply.raw.write(`data: ${data}\n\n`);
        };

        bus.on("reindex", onReindex);

        req.raw.on("close", () => {
          bus.removeListener("reindex", onReindex);
          reply.raw.end();
        });
      });
    };

    registerEventsRoute(app);
    app.register(
      async (api) => {
        registerEventsRoute(api);
      },
      { prefix: "/api" }
    );
  }

  // Legacy (no prefix) for backwards compatibility.
  registerApiRoutes(app, deps, crawlerAllowlistDomains, graphCache);

  // Deployment path: mount routes under `/api/*`.
  app.register(
    async (api) => {
      registerApiRoutes(api, deps, crawlerAllowlistDomains, graphCache);
    },
    { prefix: "/api" }
  );

  return app;
}
