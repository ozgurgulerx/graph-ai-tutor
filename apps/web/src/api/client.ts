import { requestCache } from "./cache";

import {
  ApiErrorSchema,
  GetChangesetResponseSchema,
  GetChangesetsResponseSchema,
  GetConceptDraftRevisionsResponseSchema,
  GetConceptResponseSchema,
  GetConceptQuizzesResponseSchema,
  GetConceptSourcesResponseSchema,
  GetEdgeEvidenceResponseSchema,
  GetReviewDueResponseSchema,
  GraphClusteredResponseSchema,
  GraphResponseSchema,
  GraphLensResponseSchema,
  PostApplyChangesetResponseSchema,
  PostChangesetStatusRequestSchema,
  PostChangesetStatusResponseSchema,
  PostChangesetItemStatusRequestSchema,
  PostChangesetItemStatusResponseSchema,
  PostConceptRequestSchema,
  PostConceptResponseSchema,
  PostConceptDistillResponseSchema,
  PostConceptSourceRequestSchema,
  PostConceptSourceResponseSchema,
  PostConceptLocalSourceRequestSchema,
  PostConceptLocalSourceResponseSchema,
  GetSourceContentResponseSchema,
  PostSourceContentRequestSchema,
  PostSourceContentResponseSchema,
  PostDraftRevisionApplyResponseSchema,
  PostDraftRevisionRejectResponseSchema,
  PostDraftRevisionRevertResponseSchema,
  PostGenerateConceptQuizzesRequestSchema,
  PostGenerateConceptQuizzesResponseSchema,
  PostReviewGradeRequestSchema,
  PostReviewGradeResponseSchema,
  PostConceptMergePreviewRequestSchema,
  PostConceptMergePreviewResponseSchema,
  PostConceptMergeApplyRequestSchema,
  PostConceptMergeApplyResponseSchema,
  PostConceptMergeUndoResponseSchema,
  GetConceptMergesResponseSchema,
  PostTutorRequestSchema,
  PostTutorResponseSchema,
  PostContextPackRequestSchema,
  PostContextPackResponseSchema,
  PostCaptureRequestSchema,
  PostCaptureResponseSchema,
  PostCreateTrainingSessionRequestSchema,
  PostCreateTrainingSessionResponseSchema,
  GetTrainingSessionResponseSchema,
  PostSubmitTrainingAnswerRequestSchema,
  PostSubmitTrainingAnswerResponseSchema,
  PostCompleteTrainingSessionResponseSchema,
  SearchUniversalResponseSchema,
  GetConceptNoteResponseSchema,
  PostConceptNoteRequestSchema,
  PostConceptNoteResponseSchema,
  GetConceptBacklinksResponseSchema,
  PostEdgeRequestSchema,
  PostEdgeResponseSchema,
  PostGenerateConceptContextResponseSchema,
  PostUpdateConceptContextRequestSchema,
  PostUpdateConceptContextResponseSchema
} from "@graph-ai-tutor/shared";
import type {
  GetChangesetResponse,
  GetChangesetsResponse,
  GetConceptDraftRevisionsResponse,
  GetConceptResponse,
  GetConceptQuizzesResponse,
  GetConceptSourcesResponse,
  GetEdgeEvidenceResponse,
  GetReviewDueResponse,
  GraphClusteredResponse,
  GraphResponse,
  GraphLensResponse,
  PostApplyChangesetResponse,
  PostChangesetItemStatusRequest,
  PostChangesetItemStatusResponse,
  PostChangesetStatusRequest,
  PostChangesetStatusResponse,
  PostConceptRequest,
  PostConceptResponse,
  PostConceptDistillResponse,
  PostConceptSourceRequest,
  PostConceptSourceResponse,
  PostConceptLocalSourceRequest,
  PostConceptLocalSourceResponse,
  GetSourceContentResponse,
  PostSourceContentRequest,
  PostSourceContentResponse,
  PostDraftRevisionApplyResponse,
  PostDraftRevisionRejectResponse,
  PostDraftRevisionRevertResponse,
  PostGenerateConceptQuizzesRequest,
  PostGenerateConceptQuizzesResponse,
  PostReviewGradeRequest,
  PostReviewGradeResponse,
  PostConceptMergePreviewRequest,
  PostConceptMergePreviewResponse,
  PostConceptMergeApplyRequest,
  PostConceptMergeApplyResponse,
  PostConceptMergeUndoResponse,
  GetConceptMergesResponse,
  PostTutorRequest,
  PostTutorResponse,
  PostContextPackRequest,
  PostContextPackResponse,
  PostCaptureRequest,
  PostCaptureResponse,
  PostCreateTrainingSessionRequest,
  PostCreateTrainingSessionResponse,
  GetTrainingSessionResponse,
  PostSubmitTrainingAnswerRequest,
  PostSubmitTrainingAnswerResponse,
  PostCompleteTrainingSessionResponse,
  SearchUniversalResponse,
  GetConceptNoteResponse,
  PostConceptNoteRequest,
  PostConceptNoteResponse,
  GetConceptBacklinksResponse,
  PostEdgeRequest,
  PostEdgeResponse,
  PostGenerateConceptContextResponse,
  PostUpdateConceptContextResponse
} from "@graph-ai-tutor/shared";

const API_BASE = "/api";

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function throwApiError(res: Response): Promise<never> {
  const body = await parseJson(res);
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new Error(`${parsed.data.error.code}: ${parsed.data.error.message}`);
  }
  throw new Error(`HTTP ${res.status}`);
}

async function requestJson<T>(
  schema: { parse: (input: unknown) => T },
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json", ...init.headers },
    ...init
  });
  if (!res.ok) return throwApiError(res);
  const body = await parseJson(res);
  return schema.parse(body);
}

export function getGraph(): Promise<GraphResponse> {
  return requestJson(GraphResponseSchema, "/graph");
}

export function getGraphLocal(center: string, depth = 2): Promise<GraphResponse> {
  const qs = `center=${encodeURIComponent(center)}&depth=${depth}`;
  return requestJson(GraphResponseSchema, `/graph?${qs}`);
}

export function getGraphClustered(): Promise<GraphClusteredResponse> {
  return requestJson(GraphClusteredResponseSchema, "/graph/clustered");
}

export function getGraphLens(
  center: string,
  radius = 1,
  edgeTypes: string[] = []
): Promise<GraphLensResponse> {
  const params = new URLSearchParams();
  params.set("center", center);
  params.set("radius", String(radius));
  if (edgeTypes.length > 0) params.set("edgeTypes", edgeTypes.join(","));
  return requestJson(GraphLensResponseSchema, `/graph/lens?${params.toString()}`);
}

export function getUniversalSearch(q: string, limit?: number): Promise<SearchUniversalResponse> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (typeof limit === "number" && Number.isFinite(limit)) {
    params.set("limit", String(Math.trunc(limit)));
  }
  return requestJson(SearchUniversalResponseSchema, `/search/universal?${params.toString()}`);
}

export function getConcept(id: string): Promise<GetConceptResponse> {
  return requestJson(GetConceptResponseSchema, `/concept/${encodeURIComponent(id)}`);
}

export function postConcept(input: PostConceptRequest): Promise<PostConceptResponse> {
  const parsed = PostConceptRequestSchema.parse(input);
  return requestJson(PostConceptResponseSchema, "/concept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function getConceptSources(conceptId: string): Promise<GetConceptSourcesResponse> {
  return requestJson(
    GetConceptSourcesResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/sources`
  );
}

export function attachConceptSource(
  conceptId: string,
  input: PostConceptSourceRequest
): Promise<PostConceptSourceResponse> {
  const parsed = PostConceptSourceRequestSchema.parse(input);
  return requestJson(
    PostConceptSourceResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/source`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postConceptLocalSource(
  conceptId: string,
  input: PostConceptLocalSourceRequest = {}
): Promise<PostConceptLocalSourceResponse> {
  const parsed = PostConceptLocalSourceRequestSchema.parse(input);
  return requestJson(
    PostConceptLocalSourceResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/source/local`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function getSourceContent(sourceId: string): Promise<GetSourceContentResponse> {
  return requestJson(
    GetSourceContentResponseSchema,
    `/source/${encodeURIComponent(sourceId)}/content`
  );
}

export function postSourceContent(
  sourceId: string,
  input: PostSourceContentRequest
): Promise<PostSourceContentResponse> {
  const parsed = PostSourceContentRequestSchema.parse(input);
  return requestJson(
    PostSourceContentResponseSchema,
    `/source/${encodeURIComponent(sourceId)}/content`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function getConceptQuizzes(conceptId: string): Promise<GetConceptQuizzesResponse> {
  return requestJson(
    GetConceptQuizzesResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/quizzes`
  );
}

export function postGenerateConceptQuizzes(
  conceptId: string,
  input: PostGenerateConceptQuizzesRequest
): Promise<PostGenerateConceptQuizzesResponse> {
  const parsed = PostGenerateConceptQuizzesRequestSchema.parse(input);
  return requestJson(
    PostGenerateConceptQuizzesResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/quizzes/generate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postConceptDistill(conceptId: string): Promise<PostConceptDistillResponse> {
  return requestJson(
    PostConceptDistillResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/distill`,
    { method: "POST" }
  );
}

export function getConceptDraftRevisions(
  conceptId: string
): Promise<GetConceptDraftRevisionsResponse> {
  return requestJson(
    GetConceptDraftRevisionsResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/draft-revisions`
  );
}

export function postDraftRevisionApply(
  conceptId: string,
  revisionId: string
): Promise<PostDraftRevisionApplyResponse> {
  return requestJson(
    PostDraftRevisionApplyResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/draft-revisions/${encodeURIComponent(revisionId)}/apply`,
    { method: "POST" }
  );
}

export function postDraftRevisionReject(
  conceptId: string,
  revisionId: string
): Promise<PostDraftRevisionRejectResponse> {
  return requestJson(
    PostDraftRevisionRejectResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/draft-revisions/${encodeURIComponent(revisionId)}/reject`,
    { method: "POST" }
  );
}

export function postDraftRevisionRevert(
  conceptId: string,
  revisionId: string
): Promise<PostDraftRevisionRevertResponse> {
  return requestJson(
    PostDraftRevisionRevertResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/draft-revisions/${encodeURIComponent(revisionId)}/revert`,
    { method: "POST" }
  );
}

export function getEdgeEvidence(edgeId: string): Promise<GetEdgeEvidenceResponse> {
  return requestJson(
    GetEdgeEvidenceResponseSchema,
    `/edge/${encodeURIComponent(edgeId)}/evidence`
  );
}

export function getChangesets(): Promise<GetChangesetsResponse> {
  return requestJson(GetChangesetsResponseSchema, "/changesets");
}

export function getChangeset(id: string): Promise<GetChangesetResponse> {
  return requestJson(GetChangesetResponseSchema, `/changeset/${encodeURIComponent(id)}`);
}

export function postChangesetItemStatus(
  changesetItemId: string,
  input: PostChangesetItemStatusRequest
): Promise<PostChangesetItemStatusResponse> {
  const parsed = PostChangesetItemStatusRequestSchema.parse(input);
  return requestJson(
    PostChangesetItemStatusResponseSchema,
    `/changeset-item/${encodeURIComponent(changesetItemId)}/status`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postApplyChangeset(changesetId: string): Promise<PostApplyChangesetResponse> {
  return requestJson(
    PostApplyChangesetResponseSchema,
    `/changeset/${encodeURIComponent(changesetId)}/apply`,
    {
      method: "POST"
    }
  );
}

export function postChangesetStatus(
  changesetId: string,
  input: PostChangesetStatusRequest
): Promise<PostChangesetStatusResponse> {
  const parsed = PostChangesetStatusRequestSchema.parse(input);
  return requestJson(
    PostChangesetStatusResponseSchema,
    `/changeset/${encodeURIComponent(changesetId)}/status`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function getReviewDue(limit?: number): Promise<GetReviewDueResponse> {
  const qs = typeof limit === "number" ? `?limit=${encodeURIComponent(String(limit))}` : "";
  return requestJson(GetReviewDueResponseSchema, `/review/due${qs}`);
}

export function postReviewGrade(
  reviewItemId: string,
  input: PostReviewGradeRequest
): Promise<PostReviewGradeResponse> {
  const parsed = PostReviewGradeRequestSchema.parse(input);
  return requestJson(
    PostReviewGradeResponseSchema,
    `/review/${encodeURIComponent(reviewItemId)}/grade`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postTutor(input: PostTutorRequest): Promise<PostTutorResponse> {
  const parsed = PostTutorRequestSchema.parse(input);
  return requestJson(PostTutorResponseSchema, "/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function postConceptMergePreview(
  input: PostConceptMergePreviewRequest
): Promise<PostConceptMergePreviewResponse> {
  const parsed = PostConceptMergePreviewRequestSchema.parse(input);
  return requestJson(PostConceptMergePreviewResponseSchema, "/concept/merge/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function postConceptMergeApply(
  input: PostConceptMergeApplyRequest
): Promise<PostConceptMergeApplyResponse> {
  const parsed = PostConceptMergeApplyRequestSchema.parse(input);
  return requestJson(PostConceptMergeApplyResponseSchema, "/concept/merge/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function postConceptMergeUndo(mergeId: string): Promise<PostConceptMergeUndoResponse> {
  return requestJson(
    PostConceptMergeUndoResponseSchema,
    `/concept/merge/${encodeURIComponent(mergeId)}/undo`,
    { method: "POST" }
  );
}

export function getConceptMerges(conceptId: string): Promise<GetConceptMergesResponse> {
  return requestJson(
    GetConceptMergesResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/merges`
  );
}

export function postContextPack(
  conceptId: string,
  input: PostContextPackRequest
): Promise<PostContextPackResponse> {
  const parsed = PostContextPackRequestSchema.parse(input);
  return requestJson(
    PostContextPackResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/context-pack`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postCapture(input: PostCaptureRequest): Promise<PostCaptureResponse> {
  const parsed = PostCaptureRequestSchema.parse(input);
  return requestJson(PostCaptureResponseSchema, "/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function postCreateTrainingSession(
  input: PostCreateTrainingSessionRequest = {}
): Promise<PostCreateTrainingSessionResponse> {
  const parsed = PostCreateTrainingSessionRequestSchema.parse(input);
  return requestJson(PostCreateTrainingSessionResponseSchema, "/training/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function getTrainingSession(id: string): Promise<GetTrainingSessionResponse> {
  return requestJson(
    GetTrainingSessionResponseSchema,
    `/training/session/${encodeURIComponent(id)}`
  );
}

export function postSubmitTrainingAnswer(
  sessionId: string,
  itemId: string,
  input: PostSubmitTrainingAnswerRequest
): Promise<PostSubmitTrainingAnswerResponse> {
  const parsed = PostSubmitTrainingAnswerRequestSchema.parse(input);
  return requestJson(
    PostSubmitTrainingAnswerResponseSchema,
    `/training/session/${encodeURIComponent(sessionId)}/item/${encodeURIComponent(itemId)}/submit`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function postCompleteTrainingSession(
  sessionId: string
): Promise<PostCompleteTrainingSessionResponse> {
  return requestJson(
    PostCompleteTrainingSessionResponseSchema,
    `/training/session/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" }
  );
}

export function getConceptNote(conceptId: string): Promise<GetConceptNoteResponse> {
  return requestJson(
    GetConceptNoteResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/note`
  );
}

export function postConceptNote(
  conceptId: string,
  input: PostConceptNoteRequest = {}
): Promise<PostConceptNoteResponse> {
  const parsed = PostConceptNoteRequestSchema.parse(input);
  return requestJson(
    PostConceptNoteResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/note`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export function getConceptBacklinks(conceptId: string): Promise<GetConceptBacklinksResponse> {
  return requestJson(
    GetConceptBacklinksResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/backlinks`
  );
}

export function postEdge(input: PostEdgeRequest): Promise<PostEdgeResponse> {
  const parsed = PostEdgeRequestSchema.parse(input);
  return requestJson(PostEdgeResponseSchema, "/edge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed)
  });
}

export function postGenerateContext(
  conceptId: string
): Promise<PostGenerateConceptContextResponse> {
  return requestJson(
    PostGenerateConceptContextResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/generate-context`,
    { method: "POST" }
  );
}

export function postUpdateContext(
  conceptId: string,
  context: string
): Promise<PostUpdateConceptContextResponse> {
  const parsed = PostUpdateConceptContextRequestSchema.parse({ context });
  return requestJson(
    PostUpdateConceptContextResponseSchema,
    `/concept/${encodeURIComponent(conceptId)}/context`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed)
    }
  );
}

export async function getConceptCached(id: string): Promise<GetConceptResponse> {
  const key = `concept:${id}`;
  const cached = requestCache.get<GetConceptResponse>(key);
  if (cached) return cached;
  const result = await getConcept(id);
  requestCache.set(key, result);
  return result;
}

export function prefetchConcept(id: string): void {
  const key = `concept:${id}`;
  if (requestCache.get(key) !== undefined) return;
  void getConceptCached(id);
}

export function invalidateConceptCache(id: string): void {
  requestCache.invalidate(`concept:${id}`);
}
