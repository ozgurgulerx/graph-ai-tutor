import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const EdgeTypeSchema = z.enum([
  "PREREQUISITE_OF",
  "PART_OF",
  "USED_IN",
  "CONTRASTS_WITH",
  "ADDRESSES_FAILURE_MODE",
  "INTRODUCED_BY",
  "POPULARIZED_BY",
  "CONFUSED_WITH",
  "IS_A",
  "ENABLES",
  "REQUIRES",
  "OPTIMIZED_BY",
  "TRAINED_WITH",
  "ALIGNED_WITH",
  "EVALUATED_BY",
  "INSTRUMENTED_BY",
  "ATTACKED_BY",
  "MITIGATED_BY",
  "GOVERNED_BY",
  "STANDARDIZED_BY",
  "PRODUCES",
  "CONSUMES",
  "HAS_MAJOR_AREA",
  "ANSWERED_BY",
  "INSTANCE_OF",
  "ADVANCES",
  "COMPETES_WITH",
  "DEPENDS_ON"
]);

export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const NodeKindSchema = z.enum([
  "Domain",
  "Concept",
  "Method",
  "Architecture",
  "Pattern",
  "Threat",
  "Control",
  "Metric",
  "Benchmark",
  "Protocol",
  "Standard",
  "Regulation",
  "Tool",
  "System",
  "Artifact",
  "Question"
]);

export type NodeKind = z.infer<typeof NodeKindSchema>;

export const ConceptSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema.optional().default("Concept"),
  l0: z.string().nullable(),
  l1: z.array(z.string()),
  l2: z.array(z.string()),
  module: z.string().nullable(),
  noteSourceId: z.string().nullable().optional().default(null),
  context: z.string().nullable().optional().default(null),
  masteryScore: z.number().optional().default(0),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type Concept = z.infer<typeof ConceptSchema>;

export const ConceptSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema.optional().default("Concept"),
  module: z.string().nullable(),
  masteryScore: z.number().optional().default(0)
});

export type ConceptSummary = z.infer<typeof ConceptSummarySchema>;

export const SourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().nullable(),
  createdAt: z.number()
});

export type Source = z.infer<typeof SourceSchema>;

export const ChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  content: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
  createdAt: z.number()
});

export type Chunk = z.infer<typeof ChunkSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  fromConceptId: z.string(),
  toConceptId: z.string(),
  type: EdgeTypeSchema,
  sourceUrl: z.string().nullable(),
  confidence: z.number().nullable(),
  verifierScore: z.number().nullable(),
  evidenceChunkIds: z.array(z.string()),
  createdAt: z.number()
});

export type Edge = z.infer<typeof EdgeSchema>;

export const EdgeEvidenceSchema = z.object({
  chunk: ChunkSchema,
  source: SourceSchema
});

export type EdgeEvidence = z.infer<typeof EdgeEvidenceSchema>;

export const EdgeSummarySchema = z.object({
  id: z.string(),
  fromConceptId: z.string(),
  toConceptId: z.string(),
  type: EdgeTypeSchema
});

export type EdgeSummary = z.infer<typeof EdgeSummarySchema>;

export const GraphResponseSchema = z.object({
  nodes: z.array(ConceptSummarySchema),
  edges: z.array(EdgeSummarySchema)
});

export type GraphResponse = z.infer<typeof GraphResponseSchema>;

export const GraphQuerySchema = z
  .object({
    center: z.string().optional(),
    depth: z.coerce.number().int().min(0).max(6).optional().default(2),
    typeFilters: z
      .preprocess((value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return [];
      }, z.array(EdgeTypeSchema))
      .optional()
      .default([])
  })
  .strict();

export type GraphQuery = z.infer<typeof GraphQuerySchema>;

export const ClusterSchema = z.object({
  module: z.string(),
  count: z.number().int().nonnegative(),
  conceptIds: z.array(z.string())
});

export type Cluster = z.infer<typeof ClusterSchema>;

export const GraphClusteredResponseSchema = z.object({
  clusters: z.array(ClusterSchema),
  interClusterEdges: z.array(EdgeSummarySchema),
  unclustered: z.array(ConceptSummarySchema)
});

export type GraphClusteredResponse = z.infer<typeof GraphClusteredResponseSchema>;

// --- Graph Lens ---

export const LensSideSchema = z.enum(["prereq", "center", "dependent", "related"]);
export type LensSide = z.infer<typeof LensSideSchema>;

export const LensNodeMetadataSchema = z.object({
  id: z.string(),
  side: LensSideSchema,
  depth: z.number().int().nonnegative(),
  rank: z.number().int().nonnegative()
});
export type LensNodeMetadata = z.infer<typeof LensNodeMetadataSchema>;

export const GraphLensQuerySchema = z
  .object({
    center: z.string().min(1),
    radius: z.coerce.number().int().min(1).max(3).optional().default(1),
    edgeTypes: z
      .preprocess((value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return [];
      }, z.array(EdgeTypeSchema))
      .optional()
      .default([])
  })
  .strict();
export type GraphLensQuery = z.infer<typeof GraphLensQuerySchema>;

export const GraphLensResponseSchema = z.object({
  nodes: z.array(ConceptSummarySchema),
  edges: z.array(EdgeSummarySchema),
  metadata: z.array(LensNodeMetadataSchema),
  warnings: z.array(z.string())
});
export type GraphLensResponse = z.infer<typeof GraphLensResponseSchema>;

export const GetConceptParamsSchema = z.object({
  id: z.string()
});

export type GetConceptParams = z.infer<typeof GetConceptParamsSchema>;

export const GetEdgeParamsSchema = z.object({
  id: z.string()
});

export type GetEdgeParams = z.infer<typeof GetEdgeParamsSchema>;

export const GetSourceParamsSchema = z.object({
  id: z.string()
});

export type GetSourceParams = z.infer<typeof GetSourceParamsSchema>;

export const GetConceptResponseSchema = z.object({
  concept: ConceptSchema
});

export type GetConceptResponse = z.infer<typeof GetConceptResponseSchema>;

export const SummaryLevelsSchema = z.object({
  l1: z.array(z.string()),
  l2: z.array(z.string())
});

export type SummaryLevels = z.infer<typeof SummaryLevelsSchema>;

export const DraftRevisionStatusSchema = z.enum(["draft", "applied", "rejected"]);

export type DraftRevisionStatus = z.infer<typeof DraftRevisionStatusSchema>;

export const DraftRevisionKindSchema = z.enum(["distill", "revert"]);

export type DraftRevisionKind = z.infer<typeof DraftRevisionKindSchema>;

export const DraftRevisionSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  kind: DraftRevisionKindSchema,
  status: DraftRevisionStatusSchema,
  before: SummaryLevelsSchema,
  after: SummaryLevelsSchema,
  diff: z.string(),
  createdAt: z.number(),
  appliedAt: z.number().nullable(),
  rejectedAt: z.number().nullable()
});

export type DraftRevision = z.infer<typeof DraftRevisionSchema>;

export const PostConceptDistillResponseSchema = z.object({
  revision: DraftRevisionSchema
});

export type PostConceptDistillResponse = z.infer<typeof PostConceptDistillResponseSchema>;

export const GetConceptDraftRevisionsResponseSchema = z.object({
  revisions: z.array(DraftRevisionSchema)
});

export type GetConceptDraftRevisionsResponse = z.infer<
  typeof GetConceptDraftRevisionsResponseSchema
>;

export const PostDraftRevisionApplyResponseSchema = z.object({
  concept: ConceptSchema,
  revision: DraftRevisionSchema
});

export type PostDraftRevisionApplyResponse = z.infer<typeof PostDraftRevisionApplyResponseSchema>;

export const PostDraftRevisionRejectResponseSchema = z.object({
  revision: DraftRevisionSchema
});

export type PostDraftRevisionRejectResponse = z.infer<typeof PostDraftRevisionRejectResponseSchema>;

export const PostDraftRevisionRevertResponseSchema = z.object({
  concept: ConceptSchema,
  revision: DraftRevisionSchema
});

export type PostDraftRevisionRevertResponse = z.infer<typeof PostDraftRevisionRevertResponseSchema>;

export const GetEdgeEvidenceResponseSchema = z.object({
  edge: EdgeSchema,
  evidence: z.array(EdgeEvidenceSchema)
});

export type GetEdgeEvidenceResponse = z.infer<typeof GetEdgeEvidenceResponseSchema>;

export const GetConceptSourcesResponseSchema = z.object({
  sources: z.array(SourceSchema)
});

export type GetConceptSourcesResponse = z.infer<typeof GetConceptSourcesResponseSchema>;

const PostConceptCreateRequestSchema = z
  .object({
    title: z.string().min(1),
    kind: NodeKindSchema.optional(),
    l0: z.string().nullable().optional(),
    l1: z.array(z.string()).optional(),
    l2: z.array(z.string()).optional(),
    module: z.string().nullable().optional()
  })
  .strict();

const PostConceptUpdateRequestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    kind: NodeKindSchema.optional(),
    l0: z.string().nullable().optional(),
    l1: z.array(z.string()).optional(),
    l2: z.array(z.string()).optional(),
    module: z.string().nullable().optional()
  })
  .strict()
  .refine((val) => Object.keys(val).some((k) => k !== "id"), {
    message: "At least one field must be provided"
  });

export const PostConceptRequestSchema = z.union([
  PostConceptCreateRequestSchema,
  PostConceptUpdateRequestSchema
]);

export type PostConceptRequest = z.infer<typeof PostConceptRequestSchema>;

export const PostConceptResponseSchema = z.object({
  concept: ConceptSchema
});

export type PostConceptResponse = z.infer<typeof PostConceptResponseSchema>;

export const PostConceptSourceRequestSchema = z
  .object({
    url: z.string().url(),
    title: z.string().min(1).nullable().optional()
  })
  .strict();

export type PostConceptSourceRequest = z.infer<typeof PostConceptSourceRequestSchema>;

export const PostConceptSourceResponseSchema = z.object({
  source: SourceSchema
});

export type PostConceptSourceResponse = z.infer<typeof PostConceptSourceResponseSchema>;

export const PostConceptLocalSourceRequestSchema = z
  .object({
    title: z.string().min(1).nullable().optional()
  })
  .strict();

export type PostConceptLocalSourceRequest = z.infer<typeof PostConceptLocalSourceRequestSchema>;

export const PostConceptLocalSourceResponseSchema = z.object({
  source: SourceSchema
});

export type PostConceptLocalSourceResponse = z.infer<typeof PostConceptLocalSourceResponseSchema>;

export const GetSourceContentResponseSchema = z.object({
  source: SourceSchema,
  content: z.string()
});

export type GetSourceContentResponse = z.infer<typeof GetSourceContentResponseSchema>;

export const PostSourceContentRequestSchema = z
  .object({
    content: z.string()
  })
  .strict();

export type PostSourceContentRequest = z.infer<typeof PostSourceContentRequestSchema>;

export const PostSourceContentResponseSchema = z.object({
  source: SourceSchema,
  contentHash: z.string(),
  chunkCount: z.number()
});

export type PostSourceContentResponse = z.infer<typeof PostSourceContentResponseSchema>;

export const PostEdgeRequestSchema = z
  .object({
    fromConceptId: z.string().min(1),
    toConceptId: z.string().min(1),
    type: EdgeTypeSchema,
    sourceUrl: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
    verifierScore: z.number().nullable().optional(),
    evidenceChunkIds: z.array(z.string().min(1)).default([])
  })
  .strict()
  .refine((val) => val.fromConceptId !== val.toConceptId, {
    message: "fromConceptId and toConceptId must differ",
    path: ["toConceptId"]
  });

export type PostEdgeRequest = z.infer<typeof PostEdgeRequestSchema>;

export const PostEdgeResponseSchema = z.object({
  edge: EdgeSchema
});

export type PostEdgeResponse = z.infer<typeof PostEdgeResponseSchema>;

export const PostCrawlRequestSchema = z
  .object({
    url: z.string().url()
  })
  .strict();

export type PostCrawlRequest = z.infer<typeof PostCrawlRequestSchema>;

export const PostCrawlResponseSchema = z.object({
  source: SourceSchema,
  deduped: z.boolean(),
  changesetId: z.string().nullable()
});

export type PostCrawlResponse = z.infer<typeof PostCrawlResponseSchema>;

export const SearchModeSchema = z.enum(["concept", "exact"]);

export type SearchMode = z.infer<typeof SearchModeSchema>;

export const SearchQuerySchema = z
  .object({
    q: z.string().optional().default(""),
    mode: SearchModeSchema.optional().default("concept"),
    limit: z.coerce.number().int().min(1).max(50).optional()
  })
  .strict();

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResponseSchema = z.object({
  results: z.array(ConceptSummarySchema)
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const ExactSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema.optional().default("Concept"),
  module: z.string().nullable(),
  masteryScore: z.number().optional().default(0),
  rank: z.number(),
  titleHighlight: z.string().nullable(),
  snippetHighlight: z.string().nullable()
});

export type ExactSearchResult = z.infer<typeof ExactSearchResultSchema>;

export const SearchExactResponseSchema = z.object({
  results: z.array(ExactSearchResultSchema)
});

export type SearchExactResponse = z.infer<typeof SearchExactResponseSchema>;

export const ChangesetStatusSchema = z.enum(["draft", "applied", "rejected"]);
export type ChangesetStatus = z.infer<typeof ChangesetStatusSchema>;

export const ChangesetSchema = z.object({
  id: z.string(),
  sourceId: z.string().nullable(),
  status: ChangesetStatusSchema,
  createdAt: z.number(),
  appliedAt: z.number().nullable()
});

export type Changeset = z.infer<typeof ChangesetSchema>;

export const ChangesetItemStatusSchema = z.enum(["pending", "accepted", "rejected", "applied"]);
export type ChangesetItemStatus = z.infer<typeof ChangesetItemStatusSchema>;

export const ChangesetItemSchema = z.object({
  id: z.string(),
  changesetId: z.string(),
  entityType: z.string(),
  action: z.string(),
  status: ChangesetItemStatusSchema,
  payload: z.unknown(),
  createdAt: z.number()
});

export type ChangesetItem = z.infer<typeof ChangesetItemSchema>;

export const ChangesetFilePatchPayloadSchema = z
  .object({
    filePath: z.string().min(1),
    unifiedDiff: z.string().min(1)
  })
  .strict();

export type ChangesetFilePatchPayload = z.infer<typeof ChangesetFilePatchPayloadSchema>;

export const EvidenceChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  content: z.string(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().nullable()
});

export type EvidenceChunk = z.infer<typeof EvidenceChunkSchema>;

export const SearchUniversalQuerySchema = z
  .object({
    q: z.string().optional().default(""),
    limit: z.coerce.number().int().min(1).max(50).optional()
  })
  .strict();

export type SearchUniversalQuery = z.infer<typeof SearchUniversalQuerySchema>;

export const SourceSearchResultSchema = z.object({
  source: SourceSchema,
  rank: z.number(),
  titleHighlight: z.string().nullable(),
  snippetHighlight: z.string().nullable(),
  conceptIds: z.array(z.string())
});

export type SourceSearchResult = z.infer<typeof SourceSearchResultSchema>;

export const EvidenceSearchResultSchema = z.object({
  chunk: EvidenceChunkSchema,
  rank: z.number(),
  snippetHighlight: z.string().nullable(),
  conceptIds: z.array(z.string())
});

export type EvidenceSearchResult = z.infer<typeof EvidenceSearchResultSchema>;

export const SearchUniversalResponseSchema = z.object({
  concepts: z.array(ExactSearchResultSchema),
  sources: z.array(SourceSearchResultSchema),
  evidence: z.array(EvidenceSearchResultSchema)
});

export type SearchUniversalResponse = z.infer<typeof SearchUniversalResponseSchema>;

export const GetChangesetsResponseSchema = z.object({
  changesets: z.array(ChangesetSchema)
});

export type GetChangesetsResponse = z.infer<typeof GetChangesetsResponseSchema>;

export const GetChangesetParamsSchema = z.object({
  id: z.string()
});

export type GetChangesetParams = z.infer<typeof GetChangesetParamsSchema>;

export const GetChangesetResponseSchema = z.object({
  changeset: ChangesetSchema,
  items: z.array(ChangesetItemSchema),
  evidenceChunks: z.array(EvidenceChunkSchema)
});

export type GetChangesetResponse = z.infer<typeof GetChangesetResponseSchema>;

export const ChangesetItemParamsSchema = z.object({
  id: z.string()
});

export type ChangesetItemParams = z.infer<typeof ChangesetItemParamsSchema>;

export const PostChangesetItemStatusRequestSchema = z
  .object({
    status: z.enum(["pending", "accepted", "rejected"])
  })
  .strict();

export type PostChangesetItemStatusRequest = z.infer<
  typeof PostChangesetItemStatusRequestSchema
>;

export const PostChangesetItemStatusResponseSchema = z.object({
  item: ChangesetItemSchema
});

export type PostChangesetItemStatusResponse = z.infer<
  typeof PostChangesetItemStatusResponseSchema
>;

export const PostApplyChangesetResponseSchema = z.object({
  changeset: ChangesetSchema,
  applied: z.object({
    conceptIds: z.array(z.string()),
    edgeIds: z.array(z.string())
  })
});

export type PostApplyChangesetResponse = z.infer<typeof PostApplyChangesetResponseSchema>;

export const PostChangesetStatusRequestSchema = z
  .object({
    status: z.enum(["draft", "rejected"])
  })
  .strict();

export type PostChangesetStatusRequest = z.infer<typeof PostChangesetStatusRequestSchema>;

export const PostChangesetStatusResponseSchema = z.object({
  changeset: ChangesetSchema
});

export type PostChangesetStatusResponse = z.infer<typeof PostChangesetStatusResponseSchema>;

export const QuizTypeSchema = z.enum(["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST"]);
export type QuizType = z.infer<typeof QuizTypeSchema>;

export const ReviewItemStatusSchema = z.enum(["draft", "active", "archived"]);
export type ReviewItemStatus = z.infer<typeof ReviewItemStatusSchema>;

const QuizRubricSchema = z
  .object({
    explanation: z.string().min(1)
  })
  .strict();

const QuizClozeAnswerSchema = z
  .object({
    blanks: z.array(z.string().min(1)).min(1)
  })
  .strict();

const QuizOrderingStepsAnswerSchema = z
  .object({
    orderedSteps: z.array(z.string().min(1)).min(2)
  })
  .strict();

const QuizCompareContrastAnswerSchema = z
  .object({
    otherConceptId: z.string().min(1),
    otherConceptTitle: z.string().min(1),
    similarities: z.array(z.string().min(1)).min(1),
    differences: z.array(z.string().min(1)).min(1)
  })
  .strict();

const QuizItemBaseSchema = z
  .object({
    id: z.string(),
    conceptId: z.string().min(1),
    prompt: z.string().min(1),
    status: ReviewItemStatusSchema,
    dueAt: z.number().nullable(),
    ease: z.number().optional().default(2.5),
    interval: z.number().int().optional().default(0),
    reps: z.number().int().optional().default(0),
    createdAt: z.number(),
    updatedAt: z.number()
  })
  .strict();

export const ReviewGradeSchema = z.enum(["wrong", "partial", "correct"]);
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;

export const GetReviewDueQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .strict();

export type GetReviewDueQuery = z.infer<typeof GetReviewDueQuerySchema>;

export const GetReviewDueResponseSchema = z
  .object({
    items: z.array(z.lazy(() => QuizItemSchema))
  })
  .strict();

export type GetReviewDueResponse = z.infer<typeof GetReviewDueResponseSchema>;

export const ReviewItemParamsSchema = z
  .object({
    id: z.string()
  })
  .strict();

export type ReviewItemParams = z.infer<typeof ReviewItemParamsSchema>;

export const PostReviewGradeRequestSchema = z
  .object({
    grade: ReviewGradeSchema
  })
  .strict();

export type PostReviewGradeRequest = z.infer<typeof PostReviewGradeRequestSchema>;

export const PostReviewGradeResponseSchema = z
  .object({
    item: z.lazy(() => QuizItemSchema)
  })
  .strict();

export type PostReviewGradeResponse = z.infer<typeof PostReviewGradeResponseSchema>;

export const QuizItemSchema = z.discriminatedUnion("type", [
  QuizItemBaseSchema.extend({
    type: z.literal("CLOZE"),
    answer: QuizClozeAnswerSchema,
    rubric: QuizRubricSchema
  }),
  QuizItemBaseSchema.extend({
    type: z.literal("ORDERING_STEPS"),
    answer: QuizOrderingStepsAnswerSchema,
    rubric: QuizRubricSchema
  }),
  QuizItemBaseSchema.extend({
    type: z.literal("COMPARE_CONTRAST"),
    answer: QuizCompareContrastAnswerSchema,
    rubric: QuizRubricSchema
  })
]);

export type QuizItem = z.infer<typeof QuizItemSchema>;

export const GetConceptQuizzesResponseSchema = z
  .object({
    quizzes: z.array(QuizItemSchema)
  })
  .strict();

export type GetConceptQuizzesResponse = z.infer<typeof GetConceptQuizzesResponseSchema>;

export const PostGenerateConceptQuizzesRequestSchema = z
  .object({
    count: z.number().int().min(1).max(20).optional().default(6)
  })
  .strict();

export type PostGenerateConceptQuizzesRequest = z.infer<
  typeof PostGenerateConceptQuizzesRequestSchema
>;

export const PostGenerateConceptQuizzesResponseSchema = z
  .object({
    quizzes: z.array(QuizItemSchema)
  })
  .strict();

export type PostGenerateConceptQuizzesResponse = z.infer<
  typeof PostGenerateConceptQuizzesResponseSchema
>;

export const TutorAnswerSchema = z
  .object({
    answer_markdown: z.string().min(1),
    cited_chunk_ids: z.array(z.string().min(1)).min(1),
    used_concept_ids: z.array(z.string().min(1)),
    used_edge_ids: z.array(z.string().min(1))
  })
  .strict();

export type TutorAnswer = z.infer<typeof TutorAnswerSchema>;

export const PostTutorRequestSchema = z
  .object({
    question: z.string().min(1)
  })
  .strict();

export type PostTutorRequest = z.infer<typeof PostTutorRequestSchema>;

export const PostTutorResponseSchema = z
  .object({
    result: TutorAnswerSchema,
    citations: z.array(EvidenceChunkSchema)
  })
  .strict();

export type PostTutorResponse = z.infer<typeof PostTutorResponseSchema>;

export const PostConceptMergePreviewRequestSchema = z
  .object({
    canonicalId: z.string().min(1),
    duplicateIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

export type PostConceptMergePreviewRequest = z.infer<
  typeof PostConceptMergePreviewRequestSchema
>;

export const ConceptMergeEdgeChangeSchema = z
  .object({
    edgeId: z.string().min(1),
    type: z.string().min(1),
    fromBefore: z.string().min(1),
    toBefore: z.string().min(1),
    fromAfter: z.string().min(1),
    toAfter: z.string().min(1),
    action: z.enum(["rewire", "delete"])
  })
  .strict();

export type ConceptMergeEdgeChange = z.infer<typeof ConceptMergeEdgeChangeSchema>;

export const PostConceptMergePreviewResponseSchema = z
  .object({
    canonical: ConceptSummarySchema,
    duplicates: z.array(ConceptSummarySchema),
    edgeChanges: z.array(ConceptMergeEdgeChangeSchema),
    counts: z
      .object({
        edgesToRewire: z.number().int().nonnegative(),
        edgesToDelete: z.number().int().nonnegative(),
        reviewItemsToUpdate: z.number().int().nonnegative(),
        sourcesToMove: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();

export type PostConceptMergePreviewResponse = z.infer<
  typeof PostConceptMergePreviewResponseSchema
>;

export const ConceptMergeSchema = z
  .object({
    id: z.string().min(1),
    canonicalId: z.string().min(1),
    duplicateIds: z.array(z.string().min(1)).min(1),
    createdAt: z.number(),
    undoneAt: z.number().nullable()
  })
  .strict();

export type ConceptMerge = z.infer<typeof ConceptMergeSchema>;

export const PostConceptMergeApplyRequestSchema = PostConceptMergePreviewRequestSchema;
export type PostConceptMergeApplyRequest = PostConceptMergePreviewRequest;

export const PostConceptMergeApplyResponseSchema = z
  .object({
    merge: ConceptMergeSchema
  })
  .strict();

export type PostConceptMergeApplyResponse = z.infer<
  typeof PostConceptMergeApplyResponseSchema
>;

export const ConceptMergeParamsSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict();

export type ConceptMergeParams = z.infer<typeof ConceptMergeParamsSchema>;

export const PostConceptMergeUndoResponseSchema = z
  .object({
    merge: ConceptMergeSchema
  })
  .strict();

export type PostConceptMergeUndoResponse = z.infer<
  typeof PostConceptMergeUndoResponseSchema
>;

export const GetConceptMergesResponseSchema = z
  .object({
    merges: z.array(ConceptMergeSchema)
  })
  .strict();

export type GetConceptMergesResponse = z.infer<typeof GetConceptMergesResponseSchema>;

// --- Context Pack ---

export const ContextPackRadiusSchema = z.enum(["1-hop", "2-hop", "prereq-path"]);
export type ContextPackRadius = z.infer<typeof ContextPackRadiusSchema>;

export const PostContextPackRequestSchema = z
  .object({
    radius: ContextPackRadiusSchema,
    includeCode: z.boolean().optional().default(false),
    includeQuiz: z.boolean().optional().default(false)
  })
  .strict();

export type PostContextPackRequest = z.infer<typeof PostContextPackRequestSchema>;

export const PostContextPackResponseSchema = z
  .object({
    markdown: z.string(),
    fileName: z.string(),
    conceptIds: z.array(z.string())
  })
  .strict();

export type PostContextPackResponse = z.infer<typeof PostContextPackResponseSchema>;

// --- Capture ---

export const PostCaptureRequestSchema = z
  .object({
    text: z.string().min(1).max(10000)
  })
  .strict();

export type PostCaptureRequest = z.infer<typeof PostCaptureRequestSchema>;

export const PostCaptureResponseSchema = z
  .object({
    changesetId: z.string(),
    itemsCreated: z.number().int().nonnegative(),
    sourceId: z.string()
  })
  .strict();

export type PostCaptureResponse = z.infer<typeof PostCaptureResponseSchema>;

// --- Training Sessions ---

export const TrainingQuestionTypeSchema = z.enum([
  "MECHANISM_TRACE",
  "FAILURE_MODE",
  "CONTRAST_EXPLAIN",
  "CODE_REASONING"
]);

export type TrainingQuestionType = z.infer<typeof TrainingQuestionTypeSchema>;

export const MechanismTraceAnswerSchema = z
  .object({
    keyPoints: z.array(z.string().min(1)).min(1),
    expectedFlow: z.string().min(1)
  })
  .strict();

export type MechanismTraceAnswer = z.infer<typeof MechanismTraceAnswerSchema>;

export const FailureModeAnswerSchema = z
  .object({
    failureConditions: z.array(z.string().min(1)).min(1),
    consequences: z.array(z.string().min(1)).min(1)
  })
  .strict();

export type FailureModeAnswer = z.infer<typeof FailureModeAnswerSchema>;

export const ContrastExplainAnswerSchema = z
  .object({
    otherConceptId: z.string().min(1),
    otherConceptTitle: z.string().min(1),
    similarities: z.array(z.string().min(1)).min(1),
    differences: z.array(z.string().min(1)).min(1)
  })
  .strict();

export type ContrastExplainAnswer = z.infer<typeof ContrastExplainAnswerSchema>;

export const CodeReasoningAnswerSchema = z
  .object({
    expectedOutput: z.string().min(1),
    explanation: z.string().min(1)
  })
  .strict();

export type CodeReasoningAnswer = z.infer<typeof CodeReasoningAnswerSchema>;

export const TrainingRubricSchema = z
  .object({
    explanation: z.string().min(1),
    keyTerms: z.array(z.string()).optional(),
    scoringCriteria: z.string().optional()
  })
  .strict();

export type TrainingRubric = z.infer<typeof TrainingRubricSchema>;

export const TrainingSessionStatusSchema = z.enum(["active", "completed", "abandoned"]);
export type TrainingSessionStatus = z.infer<typeof TrainingSessionStatusSchema>;

export const TrainingSessionSchema = z.object({
  id: z.string(),
  status: TrainingSessionStatusSchema,
  conceptIds: z.array(z.string()),
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  partialCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  startedAt: z.number(),
  completedAt: z.number().nullable()
});

export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

export const TrainingSessionItemGradeSchema = z.enum(["correct", "partial", "wrong"]);
export type TrainingSessionItemGrade = z.infer<typeof TrainingSessionItemGradeSchema>;

export const TrainingSessionItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  reviewItemId: z.string(),
  position: z.number().int().nonnegative(),
  userAnswer: z.string().nullable(),
  grade: TrainingSessionItemGradeSchema.nullable(),
  feedback: z.string().nullable(),
  gradedAt: z.number().nullable(),
  createdAt: z.number()
});

export type TrainingSessionItem = z.infer<typeof TrainingSessionItemSchema>;

// Training question items (extends review items for training types)
const TrainingItemBaseSchema = z.object({
  id: z.string(),
  conceptId: z.string().min(1),
  prompt: z.string().min(1),
  status: ReviewItemStatusSchema,
  dueAt: z.number().nullable(),
  ease: z.number().optional().default(2.5),
  interval: z.number().int().optional().default(0),
  reps: z.number().int().optional().default(0),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const TrainingQuizItemSchema = z.discriminatedUnion("type", [
  TrainingItemBaseSchema.extend({
    type: z.literal("MECHANISM_TRACE"),
    answer: MechanismTraceAnswerSchema,
    rubric: TrainingRubricSchema
  }),
  TrainingItemBaseSchema.extend({
    type: z.literal("FAILURE_MODE"),
    answer: FailureModeAnswerSchema,
    rubric: TrainingRubricSchema
  }),
  TrainingItemBaseSchema.extend({
    type: z.literal("CONTRAST_EXPLAIN"),
    answer: ContrastExplainAnswerSchema,
    rubric: TrainingRubricSchema
  }),
  TrainingItemBaseSchema.extend({
    type: z.literal("CODE_REASONING"),
    answer: CodeReasoningAnswerSchema,
    rubric: TrainingRubricSchema
  })
]);

export type TrainingQuizItem = z.infer<typeof TrainingQuizItemSchema>;

// API request/response schemas

export const PostCreateTrainingSessionRequestSchema = z
  .object({
    conceptIds: z.array(z.string().min(1)).min(1).max(10).optional()
  })
  .strict();

export type PostCreateTrainingSessionRequest = z.infer<typeof PostCreateTrainingSessionRequestSchema>;

export const PostCreateTrainingSessionResponseSchema = z
  .object({
    session: TrainingSessionSchema,
    items: z.array(TrainingSessionItemSchema),
    questions: z.array(TrainingQuizItemSchema)
  })
  .strict();

export type PostCreateTrainingSessionResponse = z.infer<typeof PostCreateTrainingSessionResponseSchema>;

export const TrainingSessionParamsSchema = z.object({
  id: z.string()
});

export type TrainingSessionParams = z.infer<typeof TrainingSessionParamsSchema>;

export const GetTrainingSessionResponseSchema = z
  .object({
    session: TrainingSessionSchema,
    items: z.array(TrainingSessionItemSchema),
    questions: z.array(TrainingQuizItemSchema)
  })
  .strict();

export type GetTrainingSessionResponse = z.infer<typeof GetTrainingSessionResponseSchema>;

export const TrainingSessionItemParamsSchema = z.object({
  id: z.string(),
  itemId: z.string()
});

export type TrainingSessionItemParams = z.infer<typeof TrainingSessionItemParamsSchema>;

export const PostSubmitTrainingAnswerRequestSchema = z
  .object({
    answer: z.string().min(1)
  })
  .strict();

export type PostSubmitTrainingAnswerRequest = z.infer<typeof PostSubmitTrainingAnswerRequestSchema>;

export const PostSubmitTrainingAnswerResponseSchema = z
  .object({
    item: TrainingSessionItemSchema,
    followUp: TrainingQuizItemSchema.nullable().optional()
  })
  .strict();

export type PostSubmitTrainingAnswerResponse = z.infer<typeof PostSubmitTrainingAnswerResponseSchema>;

export const PostCompleteTrainingSessionResponseSchema = z
  .object({
    session: TrainingSessionSchema
  })
  .strict();

export type PostCompleteTrainingSessionResponse = z.infer<typeof PostCompleteTrainingSessionResponseSchema>;

// --- Concept Note ---

export const GetConceptNoteResponseSchema = z.object({
  source: SourceSchema.nullable(),
  content: z.string()
});

export type GetConceptNoteResponse = z.infer<typeof GetConceptNoteResponseSchema>;

export const PostConceptNoteRequestSchema = z
  .object({
    title: z.string().min(1).nullable().optional()
  })
  .strict();

export type PostConceptNoteRequest = z.infer<typeof PostConceptNoteRequestSchema>;

export const PostConceptNoteResponseSchema = z.object({
  source: SourceSchema
});

export type PostConceptNoteResponse = z.infer<typeof PostConceptNoteResponseSchema>;

export const GetConceptBacklinksResponseSchema = z.object({
  concepts: z.array(ConceptSummarySchema)
});

export type GetConceptBacklinksResponse = z.infer<typeof GetConceptBacklinksResponseSchema>;

// --- Concept Context ---

export const PostGenerateConceptContextResponseSchema = z
  .object({
    concept: ConceptSchema
  })
  .strict();

export type PostGenerateConceptContextResponse = z.infer<
  typeof PostGenerateConceptContextResponseSchema
>;

export const PostUpdateConceptContextRequestSchema = z
  .object({
    context: z.string()
  })
  .strict();

export type PostUpdateConceptContextRequest = z.infer<
  typeof PostUpdateConceptContextRequestSchema
>;

export const PostUpdateConceptContextResponseSchema = z
  .object({
    concept: ConceptSchema
  })
  .strict();

export type PostUpdateConceptContextResponse = z.infer<
  typeof PostUpdateConceptContextResponseSchema
>;
