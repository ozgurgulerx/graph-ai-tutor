import crypto from "node:crypto";

import {
  DEFAULT_EASE,
  DEFAULT_INTERVAL,
  DEFAULT_REPS,
  sm2NextSchedule,
  updateMasteryScore,
  type ReviewGrade
} from "./srs";

export type NodeKind =
  | "Domain"
  | "Concept"
  | "Method"
  | "Architecture"
  | "Pattern"
  | "Threat"
  | "Control"
  | "Metric"
  | "Benchmark"
  | "Protocol"
  | "Standard"
  | "Regulation"
  | "Tool"
  | "System"
  | "Artifact"
  | "Question";

export type Concept = {
  id: string;
  title: string;
  kind: NodeKind;
  l0: string | null;
  l1: string[];
  l2: string[];
  module: string | null;
  noteSourceId: string | null;
  context: string | null;
  masteryScore: number;
  createdAt: number;
  updatedAt: number;
};

export type ConceptSummary = {
  id: string;
  title: string;
  kind: NodeKind;
  module: string | null;
  masteryScore: number;
  pagerank: number;
  community: string | null;
};

export type ExactConceptSearchResult = ConceptSummary & {
  rank: number;
  titleHighlight: string | null;
  snippetHighlight: string | null;
};

export type ExactSourceSearchResult = Source & {
  rank: number;
  titleHighlight: string | null;
  snippetHighlight: string | null;
};

export type ExactEvidenceChunkSearchResult = {
  chunk: EvidenceChunk;
  rank: number;
  snippetHighlight: string | null;
};

export type ConceptCreate = {
  id?: string;
  title: string;
  kind?: NodeKind;
  l0?: string | null;
  l1?: string[];
  l2?: string[];
  module?: string | null;
  noteSourceId?: string | null;
};

export type ConceptUpdate = {
  id: string;
  title?: string;
  kind?: NodeKind;
  l0?: string | null;
  l1?: string[];
  l2?: string[];
  module?: string | null;
  noteSourceId?: string | null;
};

export type EdgeType =
  | "PREREQUISITE_OF"
  | "PART_OF"
  | "USED_IN"
  | "CONTRASTS_WITH"
  | "ADDRESSES_FAILURE_MODE"
  | "INTRODUCED_BY"
  | "POPULARIZED_BY"
  | "CONFUSED_WITH"
  | "IS_A"
  | "ENABLES"
  | "REQUIRES"
  | "OPTIMIZED_BY"
  | "TRAINED_WITH"
  | "ALIGNED_WITH"
  | "EVALUATED_BY"
  | "INSTRUMENTED_BY"
  | "ATTACKED_BY"
  | "MITIGATED_BY"
  | "GOVERNED_BY"
  | "STANDARDIZED_BY"
  | "PRODUCES"
  | "CONSUMES"
  | "HAS_MAJOR_AREA"
  | "ANSWERED_BY"
  | "INSTANCE_OF"
  | "ADVANCES"
  | "COMPETES_WITH"
  | "DEPENDS_ON";

export type Edge = {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  type: EdgeType;
  sourceUrl: string | null;
  confidence: number | null;
  verifierScore: number | null;
  evidenceChunkIds: string[];
  createdAt: number;
};

export type EdgeSummary = {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  type: EdgeType;
};

export type EdgeCreate = {
  id?: string;
  fromConceptId: string;
  toConceptId: string;
  type: EdgeType;
  sourceUrl?: string | null;
  confidence?: number | null;
  verifierScore?: number | null;
  evidenceChunkIds?: string[];
};

export type Source = {
  id: string;
  url: string;
  title: string | null;
  createdAt: number;
};

export type SourceCreate = {
  id?: string;
  url: string;
  title?: string | null;
};

export type SourceContent = {
  sourceId: string;
  content: string;
  contentHash: string;
  contentType: string | null;
  fetchedAt: number;
};

export type SourceContentUpsert = {
  sourceId: string;
  content: string;
  contentHash: string;
  contentType?: string | null;
  fetchedAt?: number;
};

export type VaultFile = {
  path: string;
  content: string;
  contentHash: string;
  updatedAt: number;
};

export type VaultFileUpsert = {
  path: string;
  content: string;
  contentHash: string;
  updatedAt?: number;
};

export type ConceptSourceLink = {
  conceptId: string;
  sourceId: string;
  createdAt: number;
};

export type Chunk = {
  id: string;
  sourceId: string;
  content: string;
  startOffset: number;
  endOffset: number;
  createdAt: number;
};

export type EvidenceChunk = {
  id: string;
  sourceId: string;
  content: string;
  sourceUrl: string;
  sourceTitle: string | null;
};

export type SummaryLevels = {
  l1: string[];
  l2: string[];
};

export type ChunkCreate = {
  id?: string;
  sourceId: string;
  content: string;
  startOffset?: number;
  endOffset?: number;
};

export type ChangesetStatus = "draft" | "applied" | "rejected";

export type Changeset = {
  id: string;
  sourceId: string | null;
  status: ChangesetStatus;
  createdAt: number;
  appliedAt: number | null;
};

export type ChangesetCreate = {
  id?: string;
  sourceId?: string | null;
  status?: ChangesetStatus;
};

export type ApplyAcceptedOptions = {
  appliedFilePatchItemIds?: string[];
  vaultFileUpdates?: VaultFileUpsert[];
};

export type ChangesetItemStatus = "pending" | "accepted" | "rejected" | "applied";

export type ChangesetItem = {
  id: string;
  changesetId: string;
  entityType: string;
  action: string;
  status: ChangesetItemStatus;
  payload: unknown;
  createdAt: number;
};

export type ChangesetItemCreate = {
  id?: string;
  changesetId: string;
  entityType: string;
  action: string;
  status?: ChangesetItemStatus;
  payload: unknown;
};

export type ReviewItemStatus = "draft" | "active" | "archived";

export type ReviewItem = {
  id: string;
  conceptId: string | null;
  type: string;
  prompt: string;
  answer: unknown;
  rubric: unknown;
  status: ReviewItemStatus;
  dueAt: number | null;
  ease: number;
  interval: number;
  reps: number;
  createdAt: number;
  updatedAt: number;
};

export type ReviewItemCreate = {
  id?: string;
  conceptId?: string | null;
  type: string;
  prompt: string;
  answer?: unknown;
  rubric?: unknown;
  status?: ReviewItemStatus;
  dueAt?: number | null;
  ease?: number;
  interval?: number;
  reps?: number;
};

export type DraftRevisionStatus = "draft" | "applied" | "rejected";

export type DraftRevision = {
  id: string;
  conceptId: string;
  kind: string;
  status: DraftRevisionStatus;
  before: SummaryLevels;
  after: SummaryLevels;
  diff: string;
  createdAt: number;
  appliedAt: number | null;
  rejectedAt: number | null;
};

export type DraftRevisionCreate = {
  id?: string;
  conceptId: string;
  kind: string;
  status?: DraftRevisionStatus;
  before: SummaryLevels;
  after: SummaryLevels;
  diff: string;
};

export type ConceptAlias = {
  aliasId: string;
  canonicalId: string;
  mergeId: string | null;
  createdAt: number;
};

export type ConceptMerge = {
  id: string;
  canonicalId: string;
  duplicateIds: string[];
  createdAt: number;
  undoneAt: number | null;
};

export type ConceptMergeEdgeChange = {
  edgeId: string;
  type: string;
  fromBefore: string;
  toBefore: string;
  fromAfter: string;
  toAfter: string;
  action: "rewire" | "delete";
};

export type ConceptMergePreview = {
  canonical: ConceptSummary;
  duplicates: ConceptSummary[];
  edgeChanges: ConceptMergeEdgeChange[];
  counts: {
    edgesToRewire: number;
    edgesToDelete: number;
    reviewItemsToUpdate: number;
    sourcesToMove: number;
  };
};

export type TrainingSessionStatus = "active" | "completed" | "abandoned";

export type TrainingSession = {
  id: string;
  status: TrainingSessionStatus;
  conceptIds: string[];
  questionCount: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  startedAt: number;
  completedAt: number | null;
};

export type TrainingSessionCreate = {
  id?: string;
  conceptIds: string[];
  questionCount?: number;
};

export type TrainingSessionItemGrade = "correct" | "partial" | "wrong";

export type TrainingSessionItem = {
  id: string;
  sessionId: string;
  reviewItemId: string;
  position: number;
  userAnswer: string | null;
  grade: TrainingSessionItemGrade | null;
  feedback: string | null;
  gradedAt: number | null;
  createdAt: number;
};

export type TrainingSessionItemCreate = {
  id?: string;
  sessionId: string;
  reviewItemId: string;
  position: number;
};

export type PgQueryResult<Row extends object = Record<string, unknown>> = {
  rows: Row[];
};

export type PgClientLike = {
  query: <Row extends object = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<PgQueryResult<Row>>;
  release: () => void;
};

export type PgPoolLike = {
  query: <Row extends object = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<PgQueryResult<Row>>;
  connect: () => Promise<PgClientLike>;
};

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hasOwn(obj: object, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Expected number-like value, got ${String(value)}`);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  return toNumber(value);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) return value;
  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(value: string, query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return value;

  let out = value;
  for (const token of Array.from(new Set(tokens))) {
    const re = new RegExp(escapeRegExp(token), "gi");
    out = out.replace(re, "<mark>$&</mark>");
  }
  return out;
}

function uniqStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSummaryLevels(value: unknown): SummaryLevels {
  if (!isObject(value)) return { l1: [], l2: [] };
  return {
    l1: toStringArray(value.l1),
    l2: toStringArray(value.l2)
  };
}

const NODE_KIND_SET = new Set<string>([
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

const EDGE_TYPE_SET = new Set<string>([
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

export function createRepositories(pool: PgPoolLike) {
  async function getEdgeEvidenceChunkIds(edgeId: string): Promise<string[]> {
    const res = await pool.query<{ chunk_id: string }>(
      "SELECT chunk_id FROM edge_evidence_chunk WHERE edge_id = $1 ORDER BY chunk_id ASC",
      [edgeId]
    );
    return res.rows.map((r) => r.chunk_id);
  }

  function normalizeLines(lines: string[]): string[] {
    return lines.map((l) => l.trim()).filter(Boolean);
  }

  function sameStringArray(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function sameLevels(a: SummaryLevels, b: SummaryLevels): boolean {
    return sameStringArray(a.l1, b.l1) && sameStringArray(a.l2, b.l2);
  }

  function buildFullReplaceDiff(label: string, before: string[], after: string[]): string {
    const a = normalizeLines(before);
    const b = normalizeLines(after);
    if (sameStringArray(a, b)) return `--- ${label} (before)\n+++ ${label} (after)\n`;
    const lines: string[] = [`--- ${label} (before)`, `+++ ${label} (after)`];
    for (const line of a) lines.push(`- ${line}`);
    for (const line of b) lines.push(`+ ${line}`);
    return `${lines.join("\n")}\n`;
  }

  function buildSummaryDiff(before: SummaryLevels, after: SummaryLevels): string {
    return [buildFullReplaceDiff("L1", before.l1, after.l1), buildFullReplaceDiff("L2", before.l2, after.l2)].join(
      "\n"
    );
  }

  function toDraftRevision(row: {
    id: string;
    concept_id: string;
    kind: string;
    status: DraftRevisionStatus;
    before_state: unknown;
    after_state: unknown;
    diff: string;
    created_at: unknown;
    applied_at: unknown | null;
    rejected_at: unknown | null;
  }): DraftRevision {
    return {
      id: row.id,
      conceptId: row.concept_id,
      kind: row.kind,
      status: row.status,
      before: toSummaryLevels(row.before_state),
      after: toSummaryLevels(row.after_state),
      diff: row.diff,
      createdAt: toNumber(row.created_at),
      appliedAt: row.applied_at === null ? null : toNumber(row.applied_at),
      rejectedAt: row.rejected_at === null ? null : toNumber(row.rejected_at)
    };
  }

  return {
    concept: {
      async create(input: ConceptCreate): Promise<Concept> {
        const now = Date.now();
        const id = input.id ?? newId("concept");
        const kind: NodeKind = input.kind ?? "Concept";
        const l1 = input.l1 ?? [];
        const l2 = input.l2 ?? [];

        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          l0: string | null;
          l1: string[] | null;
          l2: string[] | null;
          module: string | null;
          note_source_id: string | null;
          context: string | null;
          mastery_score: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `INSERT INTO concept (id, title, kind, l0, l1, l2, module, note_source_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at`,
          [id, input.title, kind, input.l0 ?? null, l1, l2, input.module ?? null, input.noteSourceId ?? null, now, now]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create concept");
        return {
          id: row.id,
          title: row.title,
          kind: row.kind,
          l0: row.l0,
          l1: toStringArray(row.l1),
          l2: toStringArray(row.l2),
          module: row.module,
          noteSourceId: row.note_source_id,
          context: row.context,
          masteryScore: toNumber(row.mastery_score),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        };
      },

      async getById(id: string): Promise<Concept | null> {
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          l0: string | null;
          l1: string[] | null;
          l2: string[] | null;
          module: string | null;
          note_source_id: string | null;
          context: string | null;
          mastery_score: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `SELECT id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at
           FROM concept
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          title: row.title,
          kind: row.kind,
          l0: row.l0,
          l1: toStringArray(row.l1),
          l2: toStringArray(row.l2),
          module: row.module,
          noteSourceId: row.note_source_id,
          context: row.context,
          masteryScore: toNumber(row.mastery_score),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        };
      },

      async update(input: ConceptUpdate): Promise<void> {
        const sets: string[] = [];
        const values: unknown[] = [];
        let i = 1;

        if (hasOwn(input, "title")) {
          sets.push(`title = $${i++}`);
          values.push(input.title ?? null);
        }
        if (hasOwn(input, "l0")) {
          sets.push(`l0 = $${i++}`);
          values.push(input.l0 ?? null);
        }
        if (hasOwn(input, "l1")) {
          sets.push(`l1 = $${i++}`);
          values.push(input.l1 ?? []);
        }
        if (hasOwn(input, "l2")) {
          sets.push(`l2 = $${i++}`);
          values.push(input.l2 ?? []);
        }
        if (hasOwn(input, "kind")) {
          sets.push(`kind = $${i++}`);
          values.push(input.kind ?? "Concept");
        }
        if (hasOwn(input, "module")) {
          sets.push(`module = $${i++}`);
          values.push(input.module ?? null);
        }
        if (hasOwn(input, "noteSourceId")) {
          sets.push(`note_source_id = $${i++}`);
          values.push(input.noteSourceId ?? null);
        }

        sets.push(`updated_at = $${i++}`);
        values.push(Date.now());

        values.push(input.id);
        const idIndex = i;

        await pool.query(
          `UPDATE concept SET ${sets.join(", ")} WHERE id = $${idIndex}`,
          values
        );
      },

      async delete(id: string): Promise<void> {
        await pool.query("DELETE FROM concept WHERE id = $1", [id]);
      },

      async updateContext(id: string, context: string): Promise<Concept | null> {
        const now = Date.now();
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          l0: string | null;
          l1: string[] | null;
          l2: string[] | null;
          module: string | null;
          note_source_id: string | null;
          context: string | null;
          mastery_score: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `UPDATE concept SET context = $1, updated_at = $2 WHERE id = $3
           RETURNING id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at`,
          [context, now, id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          title: row.title,
          kind: row.kind,
          l0: row.l0,
          l1: toStringArray(row.l1),
          l2: toStringArray(row.l2),
          module: row.module,
          noteSourceId: row.note_source_id,
          context: row.context,
          masteryScore: toNumber(row.mastery_score),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        };
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM concept");
        return toNumber(res.rows[0]?.n);
      },

      async listSummaries(): Promise<ConceptSummary[]> {
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          pagerank: unknown;
          community: string | null;
        }>("SELECT id, title, kind, module, mastery_score, COALESCE(pagerank, 0) AS pagerank, community FROM concept ORDER BY title ASC");
        return res.rows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          module: r.module,
          masteryScore: toNumber(r.mastery_score),
          pagerank: toNumber(r.pagerank),
          community: r.community ?? null
        }));
      },

      async listSummariesByIds(ids: string[]): Promise<ConceptSummary[]> {
        if (ids.length === 0) return [];
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          pagerank: unknown;
          community: string | null;
        }>(
          `SELECT id, title, kind, module, mastery_score, COALESCE(pagerank, 0) AS pagerank, community
           FROM concept
           WHERE id IN (${placeholders})
           ORDER BY title ASC`,
          ids
        );
        return res.rows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          module: r.module,
          masteryScore: toNumber(r.mastery_score),
          pagerank: toNumber(r.pagerank),
          community: r.community ?? null
        }));
      },

      async searchSummaries(q: string, limit: number): Promise<ConceptSummary[]> {
        const query = `%${q}%`;
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          pagerank: unknown;
          community: string | null;
        }>(
          `SELECT id, title, kind, module, mastery_score, COALESCE(pagerank, 0) AS pagerank, community
           FROM concept
           WHERE title LIKE $1 OR COALESCE(l0, '') LIKE $1
           ORDER BY title ASC
           LIMIT $2`,
          [query, limit]
        );
        return res.rows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          module: r.module,
          masteryScore: toNumber(r.mastery_score),
          pagerank: toNumber(r.pagerank),
          community: r.community ?? null
        }));
      },

      async searchExact(q: string, limit: number): Promise<ExactConceptSearchResult[]> {
        const query = q.trim();
        if (!query) return [];

        type Row = {
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          rank: number;
          title_highlight: string;
          snippet_highlight: string;
        };

        try {
          const res = await pool.query<Row>(
            `SELECT
               id,
               title,
               kind,
               module,
               mastery_score,
               ts_rank(
                 (setweight(to_tsvector('english', coalesce(title, '')), 'A')
                  || setweight(to_tsvector('english', coalesce(l0, '')), 'B')
                  || setweight(to_tsvector('english', array_to_string(l1, ' ')), 'C')
                  || setweight(to_tsvector('english', array_to_string(l2, ' ')), 'D')),
                 plainto_tsquery('english', $1)
               ) AS rank,
               ts_headline(
                 'english',
                 title,
                 plainto_tsquery('english', $1),
                 'StartSel=<mark>,StopSel=</mark>'
               ) AS title_highlight,
               ts_headline(
                 'english',
                 (coalesce(l0, '') || ' ' || array_to_string(l1, ' ') || ' ' || array_to_string(l2, ' ')),
                 plainto_tsquery('english', $1),
                 'StartSel=<mark>,StopSel=</mark>,MaxWords=24,MinWords=8,ShortWord=3,MaxFragments=2,FragmentDelimiter=...'
               ) AS snippet_highlight
             FROM concept
             WHERE (setweight(to_tsvector('english', coalesce(title, '')), 'A')
                    || setweight(to_tsvector('english', coalesce(l0, '')), 'B')
                    || setweight(to_tsvector('english', array_to_string(l1, ' ')), 'C')
                    || setweight(to_tsvector('english', array_to_string(l2, ' ')), 'D'))
                   @@ plainto_tsquery('english', $1)
             ORDER BY rank DESC, id ASC
             LIMIT $2`,
            [query, limit]
          );

          return res.rows.map((r) => ({
            id: r.id,
            title: r.title,
            kind: r.kind,
            module: r.module,
            masteryScore: toNumber(r.mastery_score),
            pagerank: 0,
            community: null,
            rank: typeof r.rank === "number" && Number.isFinite(r.rank) ? r.rank : 0,
            titleHighlight: r.title_highlight,
            snippetHighlight: r.snippet_highlight
          }));
        } catch {
          // pg-mem doesn't support FTS functions; fall back to substring matching.
        }

        const like = `%${query}%`;
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          l0: string | null;
        }>(
          `SELECT id, title, kind, module, mastery_score, l0
           FROM concept
           WHERE title ILIKE $1 OR COALESCE(l0, '') ILIKE $1
           ORDER BY title ASC, id ASC
           LIMIT $2`,
          [like, limit]
        );

        return res.rows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          module: r.module,
          masteryScore: toNumber(r.mastery_score),
          pagerank: 0,
          community: null,
          rank: 0,
          titleHighlight: highlightText(r.title, query),
          snippetHighlight: highlightText(r.l0 ?? "", query)
        }));
      },

      async listBacklinkConcepts(title: string): Promise<ConceptSummary[]> {
        // Fetch all concepts that have notes, along with note content
        const res = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
          content: string;
        }>(
          `SELECT c.id, c.title, c.kind, c.module, c.mastery_score, sc.content
           FROM concept c
           JOIN source_content sc ON sc.source_id = c.note_source_id
           WHERE c.note_source_id IS NOT NULL
           ORDER BY c.title ASC`
        );
        const needle = `[[${title}]]`;
        const filtered = res.rows.filter((r) => r.content.includes(needle));
        return filtered.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          module: r.module,
          masteryScore: toNumber(r.mastery_score),
          pagerank: 0,
          community: null
        }));
      },

      async getNeighborhoodIds(
        centerId: string,
        depth: number,
        typeFilters?: string[]
      ): Promise<string[]> {
        const seen = new Set<string>([centerId]);
        let frontier = new Set<string>([centerId]);
        const typeSet = typeFilters && typeFilters.length > 0 ? new Set(typeFilters) : null;

        for (let i = 0; i < depth; i++) {
          if (frontier.size === 0) break;
          const frontierIds = Array.from(frontier);
          const placeholders = frontierIds.map((_, idx) => `$${idx + 1}`).join(", ");
          const edgeRows = await pool.query<{
            from_concept_id: string;
            to_concept_id: string;
            type: string;
          }>(
            `SELECT from_concept_id, to_concept_id, type FROM edge
             WHERE from_concept_id IN (${placeholders}) OR to_concept_id IN (${placeholders})`,
            frontierIds
          );

          const next = new Set<string>();
          for (const row of edgeRows.rows) {
            if (typeSet && !typeSet.has(row.type)) continue;
            if (!seen.has(row.from_concept_id)) {
              seen.add(row.from_concept_id);
              next.add(row.from_concept_id);
            }
            if (!seen.has(row.to_concept_id)) {
              seen.add(row.to_concept_id);
              next.add(row.to_concept_id);
            }
          }
          frontier = next;
        }

        return Array.from(seen);
      },

      async listSummariesGroupedByModule(): Promise<
        { module: string; count: number; conceptIds: string[] }[]
      > {
        const res = await pool.query<{
          id: string;
          module: string | null;
        }>("SELECT id, module FROM concept ORDER BY module ASC, title ASC");

        const groups = new Map<string, string[]>();
        for (const row of res.rows) {
          const mod = row.module ?? "(uncategorized)";
          const arr = groups.get(mod) ?? [];
          arr.push(row.id);
          groups.set(mod, arr);
        }

        return Array.from(groups.entries()).map(([mod, ids]) => ({
          module: mod,
          count: ids.length,
          conceptIds: ids
        }));
      },

      /** Batch-update pagerank scores. */
      async updatePageRanks(ranks: Map<string, number>): Promise<void> {
        if (ranks.size === 0) return;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const [id, score] of ranks) {
            await client.query(
              "UPDATE concept SET pagerank = $2 WHERE id = $1",
              [id, score]
            );
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },

      /** Batch-update community labels. */
      async updateCommunities(communities: Map<string, string>): Promise<void> {
        if (communities.size === 0) return;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const [id, community] of communities) {
            await client.query(
              "UPDATE concept SET community = $2 WHERE id = $1",
              [id, community]
            );
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }
    },

    conceptAlias: {
      async getCanonicalId(aliasId: string): Promise<string | null> {
        const res = await pool.query<{ canonical_id: string }>(
          "SELECT canonical_id FROM concept_alias WHERE alias_id = $1",
          [aliasId]
        );
        return res.rows[0]?.canonical_id ?? null;
      },

      async listByCanonicalId(canonicalId: string, limit: number): Promise<ConceptAlias[]> {
        const res = await pool.query<{
          alias_id: string;
          canonical_id: string;
          merge_id: string | null;
          created_at: unknown;
        }>(
          `SELECT alias_id, canonical_id, merge_id, created_at
           FROM concept_alias
           WHERE canonical_id = $1
           ORDER BY created_at DESC, alias_id ASC
           LIMIT $2`,
          [canonicalId, limit]
        );
        return res.rows.map((r) => ({
          aliasId: r.alias_id,
          canonicalId: r.canonical_id,
          mergeId: r.merge_id,
          createdAt: toNumber(r.created_at)
        }));
      }
    },

    conceptMerge: {
      async getById(id: string): Promise<ConceptMerge | null> {
        const res = await pool.query<{
          id: string;
          canonical_id: string;
          duplicate_ids: unknown;
          created_at: unknown;
          undone_at: unknown | null;
        }>(
          `SELECT id, canonical_id, duplicate_ids, created_at, undone_at
           FROM concept_merge
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          canonicalId: row.canonical_id,
          duplicateIds: toStringArray(row.duplicate_ids),
          createdAt: toNumber(row.created_at),
          undoneAt: row.undone_at === null ? null : toNumber(row.undone_at)
        };
      },

      async listByCanonicalId(canonicalId: string, limit: number): Promise<ConceptMerge[]> {
        const res = await pool.query<{
          id: string;
          canonical_id: string;
          duplicate_ids: unknown;
          created_at: unknown;
          undone_at: unknown | null;
        }>(
          `SELECT id, canonical_id, duplicate_ids, created_at, undone_at
           FROM concept_merge
           WHERE canonical_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [canonicalId, limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          canonicalId: row.canonical_id,
          duplicateIds: toStringArray(row.duplicate_ids),
          createdAt: toNumber(row.created_at),
          undoneAt: row.undone_at === null ? null : toNumber(row.undone_at)
        }));
      },

      async preview(input: {
        canonicalId: string;
        duplicateIds: string[];
        edgeLimit?: number;
      }): Promise<ConceptMergePreview> {
        const canonicalId = input.canonicalId;
        const duplicateIds = uniqStrings(input.duplicateIds).filter((id) => id !== canonicalId);
        if (duplicateIds.length === 0) {
          throw new Error("At least one duplicate concept id is required");
        }

        const canonicalRes = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
        }>("SELECT id, title, kind, module, mastery_score FROM concept WHERE id = $1", [
          canonicalId
        ]);
        const canonicalRow = canonicalRes.rows[0];
        if (!canonicalRow) throw new Error(`Canonical concept not found: ${canonicalId}`);

        const placeholders = duplicateIds.map((_, i) => `$${i + 1}`).join(", ");
        const dupRes = await pool.query<{
          id: string;
          title: string;
          kind: NodeKind;
          module: string | null;
          mastery_score: unknown;
        }>(
          `SELECT id, title, kind, module, mastery_score
           FROM concept
           WHERE id IN (${placeholders})
           ORDER BY title ASC`,
          duplicateIds
        );
        if (dupRes.rows.length !== duplicateIds.length) {
          const found = new Set(dupRes.rows.map((r) => r.id));
          const missing = duplicateIds.filter((id) => !found.has(id));
          throw new Error(`Duplicate concept(s) not found: ${missing.join(", ")}`);
        }

        const aliasRes = await pool.query<{ alias_id: string }>(
          `SELECT alias_id FROM concept_alias WHERE alias_id IN (${placeholders})`,
          duplicateIds
        );
        if (aliasRes.rows.length > 0) {
          throw new Error(`Some duplicates are already aliases: ${aliasRes.rows[0]?.alias_id}`);
        }

        const edgeLimit = input.edgeLimit ?? 200;
        const edgesRes = await pool.query<{
          id: string;
          from_concept_id: string;
          to_concept_id: string;
          type: string;
        }>(
          `SELECT id, from_concept_id, to_concept_id, type
           FROM edge
           WHERE from_concept_id IN (${placeholders}) OR to_concept_id IN (${placeholders})
           ORDER BY id ASC
           LIMIT $${duplicateIds.length + 1}`,
          [...duplicateIds, edgeLimit]
        );

        const dupSet = new Set(duplicateIds);
        let edgesToRewire = 0;
        let edgesToDelete = 0;
        const edgeChanges: ConceptMergeEdgeChange[] = edgesRes.rows.map((e) => {
          const fromAfter = dupSet.has(e.from_concept_id) ? canonicalId : e.from_concept_id;
          const toAfter = dupSet.has(e.to_concept_id) ? canonicalId : e.to_concept_id;
          const action: ConceptMergeEdgeChange["action"] =
            fromAfter === toAfter ? "delete" : "rewire";
          if (action === "delete") edgesToDelete += 1;
          else edgesToRewire += 1;
          return {
            edgeId: e.id,
            type: e.type,
            fromBefore: e.from_concept_id,
            toBefore: e.to_concept_id,
            fromAfter,
            toAfter,
            action
          };
        });

        const reviewRes = await pool.query<{ n: unknown }>(
          `SELECT COUNT(1) AS n FROM review_item WHERE concept_id IN (${placeholders})`,
          duplicateIds
        );
        const sourcesRes = await pool.query<{ n: unknown }>(
          `SELECT COUNT(1) AS n FROM concept_source WHERE concept_id IN (${placeholders})`,
          duplicateIds
        );

        return {
          canonical: {
            id: canonicalRow.id,
            title: canonicalRow.title,
            kind: canonicalRow.kind,
            module: canonicalRow.module,
            masteryScore: toNumber(canonicalRow.mastery_score),
            pagerank: 0,
            community: null
          },
          duplicates: dupRes.rows.map((r) => ({
            id: r.id,
            title: r.title,
            kind: r.kind,
            module: r.module,
            masteryScore: toNumber(r.mastery_score),
            pagerank: 0,
            community: null
          })),
          edgeChanges,
          counts: {
            edgesToRewire,
            edgesToDelete,
            reviewItemsToUpdate: toNumber(reviewRes.rows[0]?.n),
            sourcesToMove: toNumber(sourcesRes.rows[0]?.n)
          }
        };
      },

      async apply(input: { canonicalId: string; duplicateIds: string[] }): Promise<ConceptMerge> {
        const canonicalId = input.canonicalId;
        const duplicateIds = uniqStrings(input.duplicateIds).filter((id) => id !== canonicalId);
        if (duplicateIds.length === 0) {
          throw new Error("At least one duplicate concept id is required");
        }

        type ConceptSourceRow = { conceptId: string; sourceId: string; createdAt: number };
        type MergeDetails = {
          duplicateConcepts: Concept[];
          edgeRewires: Array<{
            edgeId: string;
            fromBefore: string;
            toBefore: string;
            fromAfter: string;
            toAfter: string;
          }>;
          deletedEdges: Array<{
            edge: {
              id: string;
              fromConceptId: string;
              toConceptId: string;
              type: string;
              sourceUrl: string | null;
              confidence: number | null;
              verifierScore: number | null;
              createdAt: number;
            };
            evidenceChunkIds: string[];
          }>;
          reviewItemUpdates: Array<{ reviewItemId: string; conceptIdBefore: string }>;
          conceptSourcesRemoved: ConceptSourceRow[];
          canonicalSourcesInserted: Array<{ sourceId: string; createdAt: number }>;
          aliasIds: string[];
        };

        const client = await pool.connect();
        const now = Date.now();
        const mergeId = newId("concept_merge");

        try {
          await client.query("BEGIN");

          const canonicalRes = await client.query<{ id: string }>(
            "SELECT id FROM concept WHERE id = $1",
            [canonicalId]
          );
          if (!canonicalRes.rows[0]) throw new Error(`Canonical concept not found: ${canonicalId}`);

          const placeholders = duplicateIds.map((_, i) => `$${i + 1}`).join(", ");
          const dupRes = await client.query<{
            id: string;
            title: string;
            kind: NodeKind;
            l0: string | null;
            l1: string[] | null;
            l2: string[] | null;
            module: string | null;
            note_source_id: string | null;
            context: string | null;
            mastery_score: unknown;
            created_at: unknown;
            updated_at: unknown;
          }>(
            `SELECT id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at
             FROM concept
             WHERE id IN (${placeholders})`,
            duplicateIds
          );
          if (dupRes.rows.length !== duplicateIds.length) {
            const found = new Set(dupRes.rows.map((r) => r.id));
            const missing = duplicateIds.filter((id) => !found.has(id));
            throw new Error(`Duplicate concept(s) not found: ${missing.join(", ")}`);
          }

          const aliasRes = await client.query<{ alias_id: string }>(
            `SELECT alias_id FROM concept_alias WHERE alias_id IN (${placeholders})`,
            duplicateIds
          );
          if (aliasRes.rows.length > 0) {
            throw new Error(`Some duplicates are already aliases: ${aliasRes.rows[0]?.alias_id}`);
          }

          await client.query(
            `INSERT INTO concept_merge (id, canonical_id, duplicate_ids, details, created_at, undone_at)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [mergeId, canonicalId, duplicateIds, {}, now]
          );

          const details: MergeDetails = {
            duplicateConcepts: dupRes.rows.map((r) => ({
              id: r.id,
              title: r.title,
              kind: r.kind,
              l0: r.l0,
              l1: toStringArray(r.l1),
              l2: toStringArray(r.l2),
              module: r.module,
              noteSourceId: r.note_source_id,
              context: r.context,
              masteryScore: toNumber(r.mastery_score),
              createdAt: toNumber(r.created_at),
              updatedAt: toNumber(r.updated_at)
            })),
            edgeRewires: [],
            deletedEdges: [],
            reviewItemUpdates: [],
            conceptSourcesRemoved: [],
            canonicalSourcesInserted: [],
            aliasIds: [...duplicateIds]
          };

          const edgesRes = await client.query<{
            id: string;
            from_concept_id: string;
            to_concept_id: string;
            type: string;
            source_url: string | null;
            confidence: number | null;
            verifier_score: number | null;
            created_at: unknown;
          }>(
            `SELECT id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, created_at
             FROM edge
             WHERE from_concept_id IN (${placeholders}) OR to_concept_id IN (${placeholders})
             ORDER BY id ASC`,
            duplicateIds
          );

          const dupSet = new Set(duplicateIds);
          for (const edge of edgesRes.rows) {
            const fromAfter = dupSet.has(edge.from_concept_id) ? canonicalId : edge.from_concept_id;
            const toAfter = dupSet.has(edge.to_concept_id) ? canonicalId : edge.to_concept_id;

            if (fromAfter === toAfter) {
              const evidenceRes = await client.query<{ chunk_id: string }>(
                "SELECT chunk_id FROM edge_evidence_chunk WHERE edge_id = $1 ORDER BY chunk_id ASC",
                [edge.id]
              );
              details.deletedEdges.push({
                edge: {
                  id: edge.id,
                  fromConceptId: edge.from_concept_id,
                  toConceptId: edge.to_concept_id,
                  type: edge.type,
                  sourceUrl: edge.source_url,
                  confidence: edge.confidence,
                  verifierScore: edge.verifier_score,
                  createdAt: toNumber(edge.created_at)
                },
                evidenceChunkIds: evidenceRes.rows.map((r) => r.chunk_id)
              });
              await client.query("DELETE FROM edge WHERE id = $1", [edge.id]);
              continue;
            }

            if (fromAfter !== edge.from_concept_id || toAfter !== edge.to_concept_id) {
              await client.query(
                "UPDATE edge SET from_concept_id = $1, to_concept_id = $2 WHERE id = $3",
                [fromAfter, toAfter, edge.id]
              );
              details.edgeRewires.push({
                edgeId: edge.id,
                fromBefore: edge.from_concept_id,
                toBefore: edge.to_concept_id,
                fromAfter,
                toAfter
              });
            }
          }

          const reviewRes = await client.query<{
            id: string;
            concept_id: string;
          }>(
            `SELECT id, concept_id
             FROM review_item
             WHERE concept_id IN (${placeholders})
             ORDER BY id ASC`,
            duplicateIds
          );
          details.reviewItemUpdates = reviewRes.rows.map((r) => ({
            reviewItemId: r.id,
            conceptIdBefore: r.concept_id
          }));
          await client.query(
            `UPDATE review_item
             SET concept_id = $${duplicateIds.length + 1}, updated_at = $${duplicateIds.length + 2}
             WHERE concept_id IN (${placeholders})`,
            [...duplicateIds, canonicalId, now]
          );

          const sourcesRes = await client.query<{
            concept_id: string;
            source_id: string;
            created_at: unknown;
          }>(
            `SELECT concept_id, source_id, created_at
             FROM concept_source
             WHERE concept_id IN (${placeholders})
             ORDER BY concept_id ASC, source_id ASC`,
            duplicateIds
          );
          details.conceptSourcesRemoved = sourcesRes.rows.map((r) => ({
            conceptId: r.concept_id,
            sourceId: r.source_id,
            createdAt: toNumber(r.created_at)
          }));

          const canonicalSourcesRes = await client.query<{ source_id: string }>(
            "SELECT source_id FROM concept_source WHERE concept_id = $1",
            [canonicalId]
          );
          const canonicalSourceIdSet = new Set(canonicalSourcesRes.rows.map((r) => r.source_id));

          for (const row of details.conceptSourcesRemoved) {
            if (canonicalSourceIdSet.has(row.sourceId)) continue;
            await client.query(
              `INSERT INTO concept_source (concept_id, source_id, created_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (concept_id, source_id) DO NOTHING`,
              [canonicalId, row.sourceId, row.createdAt]
            );
            details.canonicalSourcesInserted.push({ sourceId: row.sourceId, createdAt: row.createdAt });
            canonicalSourceIdSet.add(row.sourceId);
          }

          if (details.conceptSourcesRemoved.length > 0) {
            await client.query(`DELETE FROM concept_source WHERE concept_id IN (${placeholders})`, [
              ...duplicateIds
            ]);
          }

          for (const dupId of duplicateIds) {
            await client.query(
              `INSERT INTO concept_alias (alias_id, canonical_id, merge_id, created_at)
               VALUES ($1, $2, $3, $4)`,
              [dupId, canonicalId, mergeId, now]
            );
          }

          await client.query(`DELETE FROM concept WHERE id IN (${placeholders})`, duplicateIds);

          await client.query("UPDATE concept_merge SET details = $1 WHERE id = $2", [
            details,
            mergeId
          ]);

          await client.query("COMMIT");
          return { id: mergeId, canonicalId, duplicateIds, createdAt: now, undoneAt: null };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },

      async undo(mergeId: string): Promise<ConceptMerge> {
        type MergeDetails = {
          duplicateConcepts: Concept[];
          edgeRewires: Array<{
            edgeId: string;
            fromBefore: string;
            toBefore: string;
            fromAfter: string;
            toAfter: string;
          }>;
          deletedEdges: Array<{
            edge: {
              id: string;
              fromConceptId: string;
              toConceptId: string;
              type: string;
              sourceUrl: string | null;
              confidence: number | null;
              verifierScore: number | null;
              createdAt: number;
            };
            evidenceChunkIds: string[];
          }>;
          reviewItemUpdates: Array<{ reviewItemId: string; conceptIdBefore: string }>;
          conceptSourcesRemoved: Array<{ conceptId: string; sourceId: string; createdAt: number }>;
          canonicalSourcesInserted: Array<{ sourceId: string; createdAt: number }>;
          aliasIds: string[];
        };

        const client = await pool.connect();
        const now = Date.now();
        try {
          await client.query("BEGIN");

          const mergeRes = await client.query<{
            id: string;
            canonical_id: string;
            duplicate_ids: unknown;
            details: unknown;
            created_at: unknown;
            undone_at: unknown | null;
          }>(
            `SELECT id, canonical_id, duplicate_ids, details, created_at, undone_at
             FROM concept_merge
             WHERE id = $1`,
            [mergeId]
          );
          const mergeRow = mergeRes.rows[0];
          if (!mergeRow) throw new Error(`Merge not found: ${mergeId}`);
          if (mergeRow.undone_at !== null) throw new Error("Merge has already been undone");

          const canonicalId = mergeRow.canonical_id;
          const duplicateIds = toStringArray(mergeRow.duplicate_ids);
          const details = mergeRow.details as MergeDetails;

          if (!details || !Array.isArray(details.duplicateConcepts)) {
            throw new Error("Invalid merge details; cannot undo");
          }

          if (duplicateIds.length === 0) throw new Error("Merge is missing duplicate ids");
          const placeholders = duplicateIds.map((_, i) => `$${i + 1}`).join(", ");

          const existingRes = await client.query<{ id: string }>(
            `SELECT id FROM concept WHERE id IN (${placeholders})`,
            duplicateIds
          );
          if (existingRes.rows.length > 0) {
            throw new Error(
              `Cannot undo merge; concept id(s) already exist: ${existingRes.rows
                .map((r) => r.id)
                .join(", ")}`
            );
          }

          for (const c of details.duplicateConcepts) {
            await client.query(
              `INSERT INTO concept (id, title, kind, l0, l1, l2, module, mastery_score, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                c.id,
                c.title,
                c.kind,
                c.l0,
                c.l1 ?? [],
                c.l2 ?? [],
                c.module,
                c.masteryScore,
                c.createdAt,
                c.updatedAt
              ]
            );
          }

          for (const e of details.edgeRewires ?? []) {
            await client.query(
              "UPDATE edge SET from_concept_id = $1, to_concept_id = $2 WHERE id = $3",
              [e.fromBefore, e.toBefore, e.edgeId]
            );
          }

          for (const d of details.deletedEdges ?? []) {
            await client.query(
              `INSERT INTO edge
               (id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                d.edge.id,
                d.edge.fromConceptId,
                d.edge.toConceptId,
                d.edge.type,
                d.edge.sourceUrl,
                d.edge.confidence,
                d.edge.verifierScore,
                d.edge.createdAt
              ]
            );
            for (const chunkId of d.evidenceChunkIds ?? []) {
              await client.query(
                "INSERT INTO edge_evidence_chunk (edge_id, chunk_id) VALUES ($1, $2)",
                [d.edge.id, chunkId]
              );
            }
          }

          for (const r of details.reviewItemUpdates ?? []) {
            await client.query(
              "UPDATE review_item SET concept_id = $1, updated_at = $2 WHERE id = $3",
              [r.conceptIdBefore, now, r.reviewItemId]
            );
          }

          for (const s of details.canonicalSourcesInserted ?? []) {
            await client.query(
              "DELETE FROM concept_source WHERE concept_id = $1 AND source_id = $2 AND created_at = $3",
              [canonicalId, s.sourceId, s.createdAt]
            );
          }

          for (const s of details.conceptSourcesRemoved ?? []) {
            await client.query(
              `INSERT INTO concept_source (concept_id, source_id, created_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (concept_id, source_id) DO NOTHING`,
              [s.conceptId, s.sourceId, s.createdAt]
            );
          }

          await client.query("DELETE FROM concept_alias WHERE merge_id = $1", [mergeId]);

          await client.query("UPDATE concept_merge SET undone_at = $1 WHERE id = $2", [
            now,
            mergeId
          ]);

          await client.query("COMMIT");

          return {
            id: mergeId,
            canonicalId,
            duplicateIds,
            createdAt: toNumber(mergeRow.created_at),
            undoneAt: now
          };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }
    },

    edge: {
      async create(input: EdgeCreate): Promise<Edge> {
        const now = Date.now();
        const id = input.id ?? newId("edge");
        const evidenceChunkIds = input.evidenceChunkIds ?? [];

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO edge
             (id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              input.fromConceptId,
              input.toConceptId,
              input.type,
              input.sourceUrl ?? null,
              input.confidence ?? null,
              input.verifierScore ?? null,
              now
            ]
          );

          for (const chunkId of evidenceChunkIds) {
            await client.query(
              `INSERT INTO edge_evidence_chunk (edge_id, chunk_id) VALUES ($1, $2)`,
              [id, chunkId]
            );
          }

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }

        const created = await this.getById(id);
        if (!created) throw new Error("Failed to create edge");
        return created;
      },

      async getById(id: string): Promise<Edge | null> {
        const res = await pool.query<{
          id: string;
          from_concept_id: string;
          to_concept_id: string;
          type: EdgeType;
          source_url: string | null;
          confidence: number | null;
          verifier_score: number | null;
          created_at: unknown;
        }>(
          `SELECT id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, created_at
           FROM edge
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        const evidenceChunkIds = await getEdgeEvidenceChunkIds(row.id);
        return {
          id: row.id,
          fromConceptId: row.from_concept_id,
          toConceptId: row.to_concept_id,
          type: row.type,
          sourceUrl: row.source_url,
          confidence: toNullableNumber(row.confidence),
          verifierScore: toNullableNumber(row.verifier_score),
          evidenceChunkIds,
          createdAt: toNumber(row.created_at)
        };
      },

      async listEvidence(edgeId: string): Promise<Array<{ chunk: Chunk; source: Source }>> {
        const res = await pool.query<{
          chunk_id: string;
          chunk_source_id: string;
          content: string;
          start_offset: number;
          end_offset: number;
          chunk_created_at: unknown;
          source_id: string;
          source_url: string;
          source_title: string | null;
          source_created_at: unknown;
        }>(
          `SELECT
             c.id AS chunk_id,
             c.source_id AS chunk_source_id,
             c.content,
             c.start_offset,
             c.end_offset,
             c.created_at AS chunk_created_at,
             s.id AS source_id,
             s.url AS source_url,
             s.title AS source_title,
             s.created_at AS source_created_at
           FROM edge_evidence_chunk ec
           JOIN chunk c ON c.id = ec.chunk_id
           JOIN source s ON s.id = c.source_id
           WHERE ec.edge_id = $1
           ORDER BY c.start_offset ASC, c.id ASC`,
          [edgeId]
        );

        return res.rows.map((r) => ({
          chunk: {
            id: r.chunk_id,
            sourceId: r.chunk_source_id,
            content: r.content,
            startOffset: r.start_offset,
            endOffset: r.end_offset,
            createdAt: toNumber(r.chunk_created_at)
          },
          source: {
            id: r.source_id,
            url: r.source_url,
            title: r.source_title,
            createdAt: toNumber(r.source_created_at)
          }
        }));
      },

      async listEvidenceChunkIdsForConcept(conceptId: string, limit: number): Promise<string[]> {
        const res = await pool.query<{ chunk_id: string }>(
          `SELECT DISTINCT ec.chunk_id
           FROM edge e
           JOIN edge_evidence_chunk ec ON ec.edge_id = e.id
           WHERE e.from_concept_id = $1 OR e.to_concept_id = $1
           ORDER BY ec.chunk_id ASC
           LIMIT $2`,
          [conceptId, limit]
        );
        return res.rows.map((r) => r.chunk_id);
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM edge");
        return toNumber(res.rows[0]?.n);
      },

      async listSummaries(): Promise<EdgeSummary[]> {
        const res = await pool.query<{
          id: string;
          from_concept_id: string;
          to_concept_id: string;
          type: EdgeType;
        }>(
          `SELECT id, from_concept_id, to_concept_id, type
           FROM edge
           ORDER BY created_at ASC`
        );
        return res.rows.map((r) => ({
          id: r.id,
          fromConceptId: r.from_concept_id,
          toConceptId: r.to_concept_id,
          type: r.type
        }));
      },

      async listSummariesByConceptIds(
        conceptIds: string[],
        limit: number
      ): Promise<EdgeSummary[]> {
        if (conceptIds.length === 0) return [];
        const placeholders = conceptIds.map((_, i) => `$${i + 1}`).join(", ");
        const limitIndex = conceptIds.length + 1;
        const res = await pool.query<{
          id: string;
          from_concept_id: string;
          to_concept_id: string;
          type: EdgeType;
        }>(
          `SELECT id, from_concept_id, to_concept_id, type
           FROM edge
           WHERE from_concept_id IN (${placeholders})
              OR to_concept_id IN (${placeholders})
           ORDER BY created_at ASC
           LIMIT $${limitIndex}`,
          [...conceptIds, limit]
        );
        return res.rows.map((r) => ({
          id: r.id,
          fromConceptId: r.from_concept_id,
          toConceptId: r.to_concept_id,
          type: r.type
        }));
      },

      async listSummariesByConceptIdsWithConfidence(
        conceptIds: string[],
        limit: number
      ): Promise<(EdgeSummary & { confidence: number | null })[]> {
        if (conceptIds.length === 0) return [];
        const placeholders = conceptIds.map((_, i) => `$${i + 1}`).join(", ");
        const limitIndex = conceptIds.length + 1;
        const res = await pool.query<{
          id: string;
          from_concept_id: string;
          to_concept_id: string;
          type: EdgeType;
          confidence: number | null;
        }>(
          `SELECT id, from_concept_id, to_concept_id, type, confidence
           FROM edge
           WHERE from_concept_id IN (${placeholders})
              OR to_concept_id IN (${placeholders})
           ORDER BY created_at ASC
           LIMIT $${limitIndex}`,
          [...conceptIds, limit]
        );
        return res.rows.map((r) => ({
          id: r.id,
          fromConceptId: r.from_concept_id,
          toConceptId: r.to_concept_id,
          type: r.type,
          confidence: r.confidence
        }));
      },

      /**
       * BFS neighborhood via recursive CTE — single round-trip.
       * Returns the set of concept IDs reachable within `depth` hops from `centerId`.
       * If `typeFilter` is provided, only edges of that type are traversed.
       * Falls back to null if the DB doesn't support recursive CTEs (e.g. pg-mem).
       */
      async listNeighborhoodCTE(
        centerId: string,
        depth: number,
        typeFilter?: string
      ): Promise<Set<string> | null> {
        const typeClause = typeFilter
          ? "AND e.type = $3"
          : "";
        const params: unknown[] = [centerId, depth];
        if (typeFilter) params.push(typeFilter);

        try {
          const res = await pool.query<{ concept_id: string }>(
            `WITH RECURSIVE neighborhood AS (
               SELECT $1::text AS concept_id, 0 AS depth
               UNION
               SELECT CASE WHEN e.from_concept_id = n.concept_id
                           THEN e.to_concept_id ELSE e.from_concept_id END,
                      n.depth + 1
               FROM neighborhood n
               JOIN edge e ON (e.from_concept_id = n.concept_id OR e.to_concept_id = n.concept_id)
                 ${typeClause}
               WHERE n.depth < $2
             ) SELECT DISTINCT concept_id FROM neighborhood`,
            params
          );
          return new Set(res.rows.map((r) => r.concept_id));
        } catch {
          // pg-mem doesn't support recursive CTEs — signal caller to use fallback
          return null;
        }
      },

      /**
       * Find shortest path between two concepts via recursive CTE.
       * Returns an ordered array of concept IDs (from → to), or null if
       * no path exists within maxDepth hops or if CTE is unsupported.
       */
      async findShortestPath(
        fromId: string,
        toId: string,
        maxDepth = 10
      ): Promise<string[] | null> {
        try {
          const res = await pool.query<{ path: string[] }>(
            `WITH RECURSIVE search AS (
               SELECT $1::text AS current_id, ARRAY[$1::text] AS path, 0 AS depth
               UNION ALL
               SELECT CASE WHEN e.from_concept_id = s.current_id
                           THEN e.to_concept_id ELSE e.from_concept_id END,
                      s.path || CASE WHEN e.from_concept_id = s.current_id
                                     THEN e.to_concept_id ELSE e.from_concept_id END,
                      s.depth + 1
               FROM search s
               JOIN edge e ON (e.from_concept_id = s.current_id OR e.to_concept_id = s.current_id)
               WHERE s.depth < $3
                 AND NOT (CASE WHEN e.from_concept_id = s.current_id
                               THEN e.to_concept_id ELSE e.from_concept_id END) = ANY(s.path)
             )
             SELECT path FROM search WHERE current_id = $2
             ORDER BY depth ASC LIMIT 1`,
            [fromId, toId, maxDepth]
          );
          return res.rows[0]?.path ?? null;
        } catch {
          return null;
        }
      }
    },

    source: {
      async create(input: SourceCreate): Promise<Source> {
        const now = Date.now();
        const id = input.id ?? newId("source");

        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>(
          `INSERT INTO source (id, url, title, created_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id, url, title, created_at`,
          [id, input.url, input.title ?? null, now]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create source");
        return { id: row.id, url: row.url, title: row.title, createdAt: toNumber(row.created_at) };
      },

      async getById(id: string): Promise<Source | null> {
        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>("SELECT id, url, title, created_at FROM source WHERE id = $1", [id]);
        const row = res.rows[0];
        if (!row) return null;
        return { id: row.id, url: row.url, title: row.title, createdAt: toNumber(row.created_at) };
      },

      async getByUrl(url: string): Promise<Source | null> {
        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>("SELECT id, url, title, created_at FROM source WHERE url = $1", [url]);
        const row = res.rows[0];
        if (!row) return null;
        return { id: row.id, url: row.url, title: row.title, createdAt: toNumber(row.created_at) };
      },

      async updateTitle(id: string, title: string | null): Promise<Source> {
        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>(
          `UPDATE source
           SET title = $2
           WHERE id = $1
           RETURNING id, url, title, created_at`,
          [id, title]
        );
        const row = res.rows[0];
        if (!row) throw new Error(`Source not found: ${id}`);
        return { id: row.id, url: row.url, title: row.title, createdAt: toNumber(row.created_at) };
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM source");
        return toNumber(res.rows[0]?.n);
      },

      async searchExact(q: string, limit: number): Promise<ExactSourceSearchResult[]> {
        const query = q.trim();
        if (!query) return [];

        type Row = {
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
          rank: number;
          title_highlight: string;
          url_highlight: string;
        };

        try {
          const res = await pool.query<Row>(
            `SELECT
               id,
               url,
               title,
               created_at,
               ts_rank(
                 to_tsvector('english', coalesce(title, '') || ' ' || url),
                 plainto_tsquery('english', $1)
               ) AS rank,
               ts_headline(
                 'english',
                 coalesce(title, ''),
                 plainto_tsquery('english', $1),
                 'StartSel=<mark>,StopSel=</mark>'
               ) AS title_highlight,
               ts_headline(
                 'english',
                 url,
                 plainto_tsquery('english', $1),
                 'StartSel=<mark>,StopSel=</mark>'
               ) AS url_highlight
             FROM source
             WHERE to_tsvector('english', coalesce(title, '') || ' ' || url) @@ plainto_tsquery('english', $1)
             ORDER BY rank DESC, id ASC
             LIMIT $2`,
            [query, limit]
          );

          return res.rows.map((r) => ({
            id: r.id,
            url: r.url,
            title: r.title,
            createdAt: toNumber(r.created_at),
            rank: typeof r.rank === "number" && Number.isFinite(r.rank) ? r.rank : 0,
            titleHighlight: r.title === null ? null : r.title_highlight,
            snippetHighlight: r.url_highlight
          }));
        } catch {
          // pg-mem doesn't support FTS functions; fall back to substring matching.
        }

        const like = `%${query}%`;
        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>(
          `SELECT id, url, title, created_at
           FROM source
           WHERE url ILIKE $1 OR COALESCE(title, '') ILIKE $1
           ORDER BY id ASC
           LIMIT $2`,
          [like, limit]
        );

        return res.rows.map((r) => ({
          id: r.id,
          url: r.url,
          title: r.title,
          createdAt: toNumber(r.created_at),
          rank: 0,
          titleHighlight: r.title === null ? null : highlightText(r.title, query),
          snippetHighlight: highlightText(r.url, query)
        }));
      }
    },

    sourceContent: {
      async getBySourceId(sourceId: string): Promise<SourceContent | null> {
        const res = await pool.query<{
          source_id: string;
          content: string;
          content_hash: string;
          content_type: string | null;
          fetched_at: unknown;
        }>(
          `SELECT source_id, content, content_hash, content_type, fetched_at
           FROM source_content
           WHERE source_id = $1`,
          [sourceId]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          sourceId: row.source_id,
          content: row.content,
          contentHash: row.content_hash,
          contentType: row.content_type,
          fetchedAt: toNumber(row.fetched_at)
        };
      },

      async upsert(input: SourceContentUpsert): Promise<SourceContent> {
        const fetchedAt = input.fetchedAt ?? Date.now();
        const contentType = typeof input.contentType === "undefined" ? null : input.contentType;

        const res = await pool.query<{
          source_id: string;
          content: string;
          content_hash: string;
          content_type: string | null;
          fetched_at: unknown;
        }>(
          `INSERT INTO source_content (source_id, content, content_hash, content_type, fetched_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (source_id) DO UPDATE
           SET content = EXCLUDED.content,
               content_hash = EXCLUDED.content_hash,
               content_type = EXCLUDED.content_type,
               fetched_at = EXCLUDED.fetched_at
           RETURNING source_id, content, content_hash, content_type, fetched_at`,
          [input.sourceId, input.content, input.contentHash, contentType, fetchedAt]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to upsert source_content");
        return {
          sourceId: row.source_id,
          content: row.content,
          contentHash: row.content_hash,
          contentType: row.content_type,
          fetchedAt: toNumber(row.fetched_at)
        };
      }
    },

    vaultFile: {
      async getByPath(filePath: string): Promise<VaultFile | null> {
        const res = await pool.query<{
          path: string;
          content: string;
          content_hash: string;
          updated_at: unknown;
        }>(
          `SELECT path, content, content_hash, updated_at
           FROM vault_file
           WHERE path = $1`,
          [filePath]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          path: row.path,
          content: row.content,
          contentHash: row.content_hash,
          updatedAt: toNumber(row.updated_at)
        };
      },

      async upsert(input: VaultFileUpsert): Promise<VaultFile> {
        const updatedAt = input.updatedAt ?? Date.now();
        const res = await pool.query<{
          path: string;
          content: string;
          content_hash: string;
          updated_at: unknown;
        }>(
          `INSERT INTO vault_file (path, content, content_hash, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (path) DO UPDATE
           SET content = EXCLUDED.content,
               content_hash = EXCLUDED.content_hash,
               updated_at = EXCLUDED.updated_at
           RETURNING path, content, content_hash, updated_at`,
          [input.path, input.content, input.contentHash, updatedAt]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to upsert vault_file");
        return {
          path: row.path,
          content: row.content,
          contentHash: row.content_hash,
          updatedAt: toNumber(row.updated_at)
        };
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM vault_file");
        return toNumber(res.rows[0]?.n);
      }
    },

    conceptSource: {
      async attach(conceptId: string, sourceId: string): Promise<void> {
        await pool.query(
          `INSERT INTO concept_source (concept_id, source_id, created_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (concept_id, source_id) DO NOTHING`,
          [conceptId, sourceId, Date.now()]
        );
      },

      async listConceptIdsBySourceIds(sourceIds: string[]): Promise<Map<string, string[]>> {
        if (sourceIds.length === 0) return new Map();
        const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(", ");
        const res = await pool.query<{ source_id: string; concept_id: string }>(
          `SELECT source_id, concept_id
           FROM concept_source
           WHERE source_id IN (${placeholders})
           ORDER BY source_id ASC, concept_id ASC`,
          sourceIds
        );

        const map = new Map<string, string[]>();
        for (const row of res.rows) {
          const existing = map.get(row.source_id);
          if (existing) existing.push(row.concept_id);
          else map.set(row.source_id, [row.concept_id]);
        }
        return map;
      },

      async listSources(conceptId: string): Promise<Source[]> {
        const res = await pool.query<{
          id: string;
          url: string;
          title: string | null;
          created_at: unknown;
        }>(
          `SELECT s.id, s.url, s.title, s.created_at
           FROM concept_source cs
           JOIN source s ON s.id = cs.source_id
           WHERE cs.concept_id = $1
           ORDER BY cs.created_at ASC`,
          [conceptId]
        );

        return res.rows.map((r) => ({
          id: r.id,
          url: r.url,
          title: r.title,
          createdAt: toNumber(r.created_at)
        }));
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>(
          "SELECT COUNT(1) AS n FROM concept_source"
        );
        return toNumber(res.rows[0]?.n);
      }
    },

    chunk: {
      async create(input: ChunkCreate): Promise<Chunk> {
        const now = Date.now();
        const id = input.id ?? newId("chunk");
        const startOffset = input.startOffset ?? 0;
        const endOffset = input.endOffset ?? input.content.length;

        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          start_offset: number;
          end_offset: number;
          created_at: unknown;
        }>(
          `INSERT INTO chunk (id, source_id, content, start_offset, end_offset, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, source_id, content, start_offset, end_offset, created_at`,
          [id, input.sourceId, input.content, startOffset, endOffset, now]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create chunk");
        return {
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          startOffset: row.start_offset,
          endOffset: row.end_offset,
          createdAt: toNumber(row.created_at)
        };
      },

      async getById(id: string): Promise<Chunk | null> {
        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          start_offset: number;
          end_offset: number;
          created_at: unknown;
        }>(
          `SELECT id, source_id, content, start_offset, end_offset, created_at
           FROM chunk
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          startOffset: row.start_offset,
          endOffset: row.end_offset,
          createdAt: toNumber(row.created_at)
        };
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM chunk");
        return toNumber(res.rows[0]?.n);
      },

      async deleteBySourceId(sourceId: string): Promise<void> {
        await pool.query("DELETE FROM chunk WHERE source_id = $1", [sourceId]);
      },

      async listBySourceId(sourceId: string): Promise<Chunk[]> {
        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          start_offset: number;
          end_offset: number;
          created_at: unknown;
        }>(
          `SELECT id, source_id, content, start_offset, end_offset, created_at
           FROM chunk
           WHERE source_id = $1
           ORDER BY start_offset ASC, id ASC`,
          [sourceId]
        );
        return res.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          startOffset: row.start_offset,
          endOffset: row.end_offset,
          createdAt: toNumber(row.created_at)
        }));
      },

      async listEvidenceByIds(ids: string[]): Promise<EvidenceChunk[]> {
        if (ids.length === 0) return [];

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          url: string;
          title: string | null;
        }>(
          `SELECT c.id, c.source_id, c.content, s.url, s.title
           FROM chunk c
           JOIN source s ON s.id = c.source_id
           WHERE c.id IN (${placeholders})
           ORDER BY c.id ASC`,
          ids
        );
        return res.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          sourceUrl: row.url,
          sourceTitle: row.title
        }));
      },

      async listRecentEvidence(limit: number): Promise<EvidenceChunk[]> {
        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          url: string;
          title: string | null;
        }>(
          `SELECT c.id, c.source_id, c.content, s.url, s.title
           FROM chunk c
           JOIN source s ON s.id = c.source_id
           ORDER BY c.created_at DESC, c.id ASC
           LIMIT $1`,
          [limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          sourceUrl: row.url,
          sourceTitle: row.title
        }));
      },

      async searchEvidence(q: string, limit: number): Promise<EvidenceChunk[]> {
        const query = q.trim();
        if (!query) return [];

        type EvidenceRow = {
          id: string;
          source_id: string;
          content: string;
          url: string;
          title: string | null;
        };

        try {
          const res = await pool.query<EvidenceRow>(
            `SELECT c.id, c.source_id, c.content, s.url, s.title
             FROM chunk c
             JOIN source s ON s.id = c.source_id
             WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
             ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) DESC, c.id ASC
             LIMIT $2`,
            [query, limit]
          );
          if (res.rows.length > 0) {
            return res.rows.map((row) => ({
              id: row.id,
              sourceId: row.source_id,
              content: row.content,
              sourceUrl: row.url,
              sourceTitle: row.title
            }));
          }
        } catch {
          // FTS functions aren't supported in pg-mem; fall back to a simple substring match.
        }

        const like = `%${query}%`;
        const res = await pool.query<EvidenceRow>(
          `SELECT c.id, c.source_id, c.content, s.url, s.title
           FROM chunk c
           JOIN source s ON s.id = c.source_id
           WHERE c.content ILIKE $1
           ORDER BY c.id ASC
           LIMIT $2`,
          [like, limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          content: row.content,
          sourceUrl: row.url,
          sourceTitle: row.title
        }));
      },

      async searchEvidenceExact(q: string, limit: number): Promise<ExactEvidenceChunkSearchResult[]> {
        const query = q.trim();
        if (!query) return [];

        type Row = {
          id: string;
          source_id: string;
          content: string;
          url: string;
          title: string | null;
          rank: number;
          snippet_highlight: string;
        };

        try {
          const res = await pool.query<Row>(
            `SELECT
               c.id,
               c.source_id,
               c.content,
               s.url,
               s.title,
               ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $1)) AS rank,
               ts_headline(
                 'english',
                 c.content,
                 plainto_tsquery('english', $1),
                 'StartSel=<mark>,StopSel=</mark>,MaxWords=24,MinWords=8,ShortWord=3,MaxFragments=2,FragmentDelimiter=...'
               ) AS snippet_highlight
             FROM chunk c
             JOIN source s ON s.id = c.source_id
             WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
             ORDER BY rank DESC, c.id ASC
             LIMIT $2`,
            [query, limit]
          );

          if (res.rows.length > 0) {
            return res.rows.map((row) => ({
              chunk: {
                id: row.id,
                sourceId: row.source_id,
                content: row.content,
                sourceUrl: row.url,
                sourceTitle: row.title
              },
              rank: typeof row.rank === "number" && Number.isFinite(row.rank) ? row.rank : 0,
              snippetHighlight: row.snippet_highlight
            }));
          }
        } catch {
          // FTS functions aren't supported in pg-mem; fall back to a simple substring match.
        }

        const like = `%${query}%`;
        const res = await pool.query<{
          id: string;
          source_id: string;
          content: string;
          url: string;
          title: string | null;
        }>(
          `SELECT c.id, c.source_id, c.content, s.url, s.title
           FROM chunk c
           JOIN source s ON s.id = c.source_id
           WHERE c.content ILIKE $1
           ORDER BY c.id ASC
           LIMIT $2`,
          [like, limit]
        );
        return res.rows.map((row) => ({
          chunk: {
            id: row.id,
            sourceId: row.source_id,
            content: row.content,
            sourceUrl: row.url,
            sourceTitle: row.title
          },
          rank: 0,
          snippetHighlight: highlightText(row.content, query)
        }));
      },

      async listConceptIdsByChunkIds(chunkIds: string[]): Promise<Map<string, string[]>> {
        if (chunkIds.length === 0) return new Map();
        const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(", ");

        const map = new Map<string, Set<string>>();
        const add = (chunkId: string, conceptId: string) => {
          const existing = map.get(chunkId);
          if (existing) existing.add(conceptId);
          else map.set(chunkId, new Set([conceptId]));
        };

        const viaSources = await pool.query<{ chunk_id: string; concept_id: string }>(
          `SELECT c.id AS chunk_id, cs.concept_id
           FROM chunk c
           JOIN concept_source cs ON cs.source_id = c.source_id
           WHERE c.id IN (${placeholders})
           ORDER BY c.id ASC, cs.concept_id ASC`,
          chunkIds
        );
        for (const row of viaSources.rows) add(row.chunk_id, row.concept_id);

        const viaEdges = await pool.query<{ chunk_id: string; concept_id: string }>(
          `SELECT ec.chunk_id, e.from_concept_id AS concept_id
           FROM edge_evidence_chunk ec
           JOIN edge e ON e.id = ec.edge_id
           WHERE ec.chunk_id IN (${placeholders})
           UNION
           SELECT ec.chunk_id, e.to_concept_id AS concept_id
           FROM edge_evidence_chunk ec
           JOIN edge e ON e.id = ec.edge_id
           WHERE ec.chunk_id IN (${placeholders})
           ORDER BY chunk_id ASC, concept_id ASC`,
          chunkIds
        );
        for (const row of viaEdges.rows) add(row.chunk_id, row.concept_id);

        const out = new Map<string, string[]>();
        for (const [chunkId, conceptIds] of map) {
          out.set(chunkId, Array.from(conceptIds).sort());
        }
        return out;
      }
    },

    changeset: {
      async create(input: ChangesetCreate = {}): Promise<Changeset> {
        const now = Date.now();
        const id = input.id ?? newId("changeset");
        const status: ChangesetStatus = input.status ?? "draft";

        const res = await pool.query<{
          id: string;
          source_id: string | null;
          status: ChangesetStatus;
          created_at: unknown;
          applied_at: unknown | null;
        }>(
          `INSERT INTO changeset (id, source_id, status, created_at, applied_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, source_id, status, created_at, applied_at`,
          [id, input.sourceId ?? null, status, now, null]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create changeset");
        return {
          id: row.id,
          sourceId: row.source_id,
          status: row.status,
          createdAt: toNumber(row.created_at),
          appliedAt: row.applied_at === null ? null : toNumber(row.applied_at)
        };
      },

      async getById(id: string): Promise<Changeset | null> {
        const res = await pool.query<{
          id: string;
          source_id: string | null;
          status: ChangesetStatus;
          created_at: unknown;
          applied_at: unknown | null;
        }>(
          "SELECT id, source_id, status, created_at, applied_at FROM changeset WHERE id = $1",
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          sourceId: row.source_id,
          status: row.status,
          createdAt: toNumber(row.created_at),
          appliedAt: row.applied_at === null ? null : toNumber(row.applied_at)
        };
      },

      async getLatestIdBySourceId(sourceId: string): Promise<string | null> {
        const res = await pool.query<{ id: string }>(
          `SELECT id
           FROM changeset
           WHERE source_id = $1
           ORDER BY created_at DESC, id ASC
           LIMIT 1`,
          [sourceId]
        );
        return res.rows[0]?.id ?? null;
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM changeset");
        return toNumber(res.rows[0]?.n);
      },

      async list(limit: number = 50): Promise<Changeset[]> {
        const res = await pool.query<{
          id: string;
          source_id: string | null;
          status: ChangesetStatus;
          created_at: unknown;
          applied_at: unknown | null;
        }>(
          `SELECT id, source_id, status, created_at, applied_at
           FROM changeset
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );

        return res.rows.map((row) => ({
          id: row.id,
          sourceId: row.source_id,
          status: row.status,
          createdAt: toNumber(row.created_at),
          appliedAt: row.applied_at === null ? null : toNumber(row.applied_at)
        }));
      },

      async updateStatus(
        id: string,
        status: Exclude<ChangesetStatus, "applied">
      ): Promise<Changeset> {
        const res = await pool.query<{
          id: string;
          source_id: string | null;
          status: ChangesetStatus;
          created_at: unknown;
          applied_at: unknown | null;
        }>(
          `UPDATE changeset
           SET status = $2
           WHERE id = $1 AND status <> 'applied'
           RETURNING id, source_id, status, created_at, applied_at`,
          [id, status]
        );
        const row = res.rows[0];
        if (!row) {
          const existing = await this.getById(id);
          if (!existing) throw new Error(`Changeset not found: ${id}`);
          if (existing.status === "applied") {
            throw new Error("Cannot update status of an applied changeset");
          }
          throw new Error("Failed to update changeset status");
        }
        return {
          id: row.id,
          sourceId: row.source_id,
          status: row.status,
          createdAt: toNumber(row.created_at),
          appliedAt: row.applied_at === null ? null : toNumber(row.applied_at)
        };
      },

      async applyAccepted(
        changesetId: string,
        options: ApplyAcceptedOptions = {}
      ): Promise<{ changeset: Changeset; appliedConceptIds: string[]; appliedEdgeIds: string[] }> {
        const client = await pool.connect();
        const now = Date.now();
        const appliedConceptIds: string[] = [];
        const appliedEdgeIds: string[] = [];

        try {
          await client.query("BEGIN");

          const csRes = await client.query<{
            id: string;
            status: ChangesetStatus;
          }>("SELECT id, status FROM changeset WHERE id = $1", [changesetId]);
          const cs = csRes.rows[0];
          if (!cs) throw new Error(`Changeset not found: ${changesetId}`);
          if (cs.status === "applied") throw new Error("Changeset already applied");
          if (cs.status === "rejected") throw new Error("Changeset is rejected");

          const itemsRes = await client.query<{
            id: string;
            entity_type: string;
            action: string;
            payload: unknown;
          }>(
            `SELECT id, entity_type, action, payload
             FROM changeset_item
             WHERE changeset_id = $1 AND status = 'accepted'
             ORDER BY created_at ASC, id ASC`,
            [changesetId]
          );
          const items = itemsRes.rows;
          if (items.length === 0) throw new Error("No accepted items to apply");

          const unsupportedItem = items.find(
            (i) =>
              !(
                (i.entity_type === "concept" && i.action === "create") ||
                (i.entity_type === "edge" && i.action === "create") ||
                (i.entity_type === "file" && i.action === "patch")
              )
          );
          if (unsupportedItem) {
            throw new Error(
              `Unsupported changeset item: ${unsupportedItem.entity_type}/${unsupportedItem.action}`
            );
          }

          const conceptCreates = items.filter(
            (i) => i.entity_type === "concept" && i.action === "create"
          );
          for (const item of conceptCreates) {
            if (typeof item.payload !== "object" || item.payload === null) {
              throw new Error(`Invalid concept payload for item ${item.id}`);
            }
            const payload = item.payload as Record<string, unknown>;

            const id = payload.id;
            const title = payload.title;
            if (typeof id !== "string" || id.trim() === "") {
              throw new Error(`Invalid concept id for item ${item.id}`);
            }
            if (typeof title !== "string" || title.trim() === "") {
              throw new Error(`Invalid concept title for item ${item.id}`);
            }

            const l0 = hasOwn(payload, "l0")
              ? payload.l0 === null
                ? null
                : typeof payload.l0 === "string"
                  ? payload.l0
                  : null
              : null;
            const l1 = hasOwn(payload, "l1") ? toStringArray(payload.l1) : [];
            const l2 = hasOwn(payload, "l2") ? toStringArray(payload.l2) : [];
            let kind: NodeKind = "Concept";
            if (hasOwn(payload, "kind")) {
              if (typeof payload.kind !== "string" || !NODE_KIND_SET.has(payload.kind)) {
                throw new Error(`Invalid concept kind for item ${item.id}`);
              }
              kind = payload.kind as NodeKind;
            }
            const module = hasOwn(payload, "module")
              ? payload.module === null
                ? null
                : typeof payload.module === "string"
                  ? payload.module
                  : null
              : null;

            await client.query(
              `INSERT INTO concept (id, title, kind, l0, l1, l2, module, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [id, title, kind, l0, l1, l2, module, now, now]
            );
            await client.query("UPDATE changeset_item SET status = 'applied' WHERE id = $1", [
              item.id
            ]);
            appliedConceptIds.push(id);
          }

          const resolveAlias = async (id: string): Promise<string> => {
            const aliasRes = await client.query<{ canonical_id: string }>(
              "SELECT canonical_id FROM concept_alias WHERE alias_id = $1",
              [id]
            );
            return aliasRes.rows[0]?.canonical_id ?? id;
          };

          const edgeCreates = items.filter((i) => i.entity_type === "edge" && i.action === "create");
          for (const item of edgeCreates) {
            if (typeof item.payload !== "object" || item.payload === null) {
              throw new Error(`Invalid edge payload for item ${item.id}`);
            }
            const payload = item.payload as Record<string, unknown>;

            const fromConceptId = payload.fromConceptId;
            const toConceptId = payload.toConceptId;
            const type = payload.type;
            if (typeof fromConceptId !== "string" || fromConceptId.trim() === "") {
              throw new Error(`Invalid fromConceptId for item ${item.id}`);
            }
            if (typeof toConceptId !== "string" || toConceptId.trim() === "") {
              throw new Error(`Invalid toConceptId for item ${item.id}`);
            }
            if (typeof type !== "string" || !EDGE_TYPE_SET.has(type)) {
              throw new Error(`Invalid edge type for item ${item.id}`);
            }

            const resolvedFrom = await resolveAlias(fromConceptId);
            const resolvedTo = await resolveAlias(toConceptId);
            if (resolvedFrom === resolvedTo) {
              throw new Error(
                `Invalid edge payload for item ${item.id}: self-loop after alias resolution`
              );
            }

            const edgeId =
              typeof payload.id === "string" && payload.id.trim() !== "" ? payload.id : newId("edge");
            const sourceUrl =
              hasOwn(payload, "sourceUrl") &&
              (payload.sourceUrl === null || typeof payload.sourceUrl === "string")
                ? (payload.sourceUrl as string | null)
                : null;
            const confidence =
              hasOwn(payload, "confidence") &&
              (payload.confidence === null || typeof payload.confidence === "number")
                ? (payload.confidence as number | null)
                : null;
            const verifierScore =
              hasOwn(payload, "verifierScore") &&
              (payload.verifierScore === null || typeof payload.verifierScore === "number")
                ? (payload.verifierScore as number | null)
                : null;
            const evidenceChunkIds = hasOwn(payload, "evidenceChunkIds")
              ? toStringArray(payload.evidenceChunkIds)
              : [];

            await client.query(
              `INSERT INTO edge
               (id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                edgeId,
                resolvedFrom,
                resolvedTo,
                type,
                sourceUrl,
                confidence,
                verifierScore,
                now
              ]
            );

            for (const chunkId of evidenceChunkIds) {
              await client.query(
                "INSERT INTO edge_evidence_chunk (edge_id, chunk_id) VALUES ($1, $2)",
                [edgeId, chunkId]
              );
            }

            await client.query("UPDATE changeset_item SET status = 'applied' WHERE id = $1", [
              item.id
            ]);
            appliedEdgeIds.push(edgeId);
          }

          const filePatchItems = items.filter((i) => i.entity_type === "file" && i.action === "patch");
          if (filePatchItems.length > 0) {
            const patchItemIds: string[] = [];
            const patchFilePaths = new Set<string>();
            for (const item of filePatchItems) {
              if (typeof item.payload !== "object" || item.payload === null) {
                throw new Error(`Invalid file patch payload for item ${item.id}`);
              }
              const payload = item.payload as Record<string, unknown>;
              const filePath = payload.filePath;
              if (typeof filePath !== "string" || filePath.trim() === "") {
                throw new Error(`Invalid filePath for item ${item.id}`);
              }
              patchItemIds.push(item.id);
              patchFilePaths.add(filePath);
            }

            const appliedIds = options.appliedFilePatchItemIds ?? [];
            const appliedIdSet = new Set(appliedIds);
            for (const id of patchItemIds) {
              if (!appliedIdSet.has(id)) {
                throw new Error(`Missing applied file patch for item ${id}`);
              }
            }
            if (appliedIdSet.size !== patchItemIds.length) {
              throw new Error("Invalid appliedFilePatchItemIds: does not match accepted file patches");
            }

            const updates = options.vaultFileUpdates ?? [];
            const updateByPath = new Map<string, VaultFileUpsert>();
            for (const update of updates) {
              if (updateByPath.has(update.path)) {
                throw new Error(`Duplicate vaultFile update for path: ${update.path}`);
              }
              updateByPath.set(update.path, update);
            }

            for (const filePath of patchFilePaths) {
              if (!updateByPath.has(filePath)) {
                throw new Error(`Missing vaultFile update for path: ${filePath}`);
              }
            }
            for (const filePath of updateByPath.keys()) {
              if (!patchFilePaths.has(filePath)) {
                throw new Error(`Unexpected vaultFile update for path: ${filePath}`);
              }
            }

            for (const update of updateByPath.values()) {
              const updatedAt = update.updatedAt ?? now;
              await client.query(
                `INSERT INTO vault_file (path, content, content_hash, updated_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (path) DO UPDATE
                 SET content = EXCLUDED.content,
                     content_hash = EXCLUDED.content_hash,
                     updated_at = EXCLUDED.updated_at`,
                [update.path, update.content, update.contentHash, updatedAt]
              );
            }

            for (const id of patchItemIds) {
              await client.query("UPDATE changeset_item SET status = 'applied' WHERE id = $1", [
                id
              ]);
            }
          }

          await client.query(
            "UPDATE changeset SET status = 'applied', applied_at = $2 WHERE id = $1",
            [changesetId, now]
          );

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }

        const changeset = await this.getById(changesetId);
        if (!changeset) throw new Error("Failed to load applied changeset");
        return { changeset, appliedConceptIds, appliedEdgeIds };
      }
    },

    changesetItem: {
      async create(input: ChangesetItemCreate): Promise<void> {
        const now = Date.now();
        const id = input.id ?? newId("changeset_item");
        const status: ChangesetItemStatus = input.status ?? "pending";

        await pool.query(
          `INSERT INTO changeset_item
           (id, changeset_id, entity_type, action, status, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, input.changesetId, input.entityType, input.action, status, input.payload, now]
        );
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM changeset_item");
        return toNumber(res.rows[0]?.n);
      },

      async getById(id: string): Promise<ChangesetItem | null> {
        const res = await pool.query<{
          id: string;
          changeset_id: string;
          entity_type: string;
          action: string;
          status: ChangesetItemStatus;
          payload: unknown;
          created_at: unknown;
        }>(
          `SELECT id, changeset_id, entity_type, action, status, payload, created_at
           FROM changeset_item
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          changesetId: row.changeset_id,
          entityType: row.entity_type,
          action: row.action,
          status: row.status,
          payload: row.payload,
          createdAt: toNumber(row.created_at)
        };
      },

      async listByChangesetId(changesetId: string): Promise<ChangesetItem[]> {
        const res = await pool.query<{
          id: string;
          changeset_id: string;
          entity_type: string;
          action: string;
          status: ChangesetItemStatus;
          payload: unknown;
          created_at: unknown;
        }>(
          `SELECT id, changeset_id, entity_type, action, status, payload, created_at
           FROM changeset_item
           WHERE changeset_id = $1
           ORDER BY created_at ASC, id ASC`,
          [changesetId]
        );
        return res.rows.map((row) => ({
          id: row.id,
          changesetId: row.changeset_id,
          entityType: row.entity_type,
          action: row.action,
          status: row.status,
          payload: row.payload,
          createdAt: toNumber(row.created_at)
        }));
      },

      async updateStatus(
        id: string,
        status: Exclude<ChangesetItemStatus, "applied">
      ): Promise<ChangesetItem> {
        const res = await pool.query<{
          id: string;
          changeset_id: string;
          entity_type: string;
          action: string;
          status: ChangesetItemStatus;
          payload: unknown;
          created_at: unknown;
        }>(
          `UPDATE changeset_item
           SET status = $2
           WHERE id = $1 AND status <> 'applied'
           RETURNING id, changeset_id, entity_type, action, status, payload, created_at`,
          [id, status]
        );
        const row = res.rows[0];
        if (!row) {
          const existing = await this.getById(id);
          if (!existing) throw new Error(`Changeset item not found: ${id}`);
          if (existing.status === "applied") throw new Error("Changeset item already applied");
          throw new Error("Failed to update changeset item status");
        }
        return {
          id: row.id,
          changesetId: row.changeset_id,
          entityType: row.entity_type,
          action: row.action,
          status: row.status,
          payload: row.payload,
          createdAt: toNumber(row.created_at)
        };
      }
    },

    reviewItem: {
      async create(input: ReviewItemCreate): Promise<void> {
        const now = Date.now();
        const id = input.id ?? newId("review_item");
        const status: ReviewItemStatus = input.status ?? "draft";
        const ease = input.ease ?? DEFAULT_EASE;
        const interval = input.interval ?? DEFAULT_INTERVAL;
        const reps = input.reps ?? DEFAULT_REPS;

        await pool.query(
          `INSERT INTO review_item
           (id, concept_id, type, prompt, answer, rubric, status, due_at, ease, interval, reps, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            id,
            input.conceptId ?? null,
            input.type,
            input.prompt,
            typeof input.answer === "undefined" ? null : input.answer,
            typeof input.rubric === "undefined" ? null : input.rubric,
            status,
            input.dueAt ?? null,
            ease,
            interval,
            reps,
            now,
            now
          ]
        );
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM review_item");
        return toNumber(res.rows[0]?.n);
      },

      async getById(id: string): Promise<ReviewItem | null> {
        const res = await pool.query<{
          id: string;
          concept_id: string | null;
          type: string;
          prompt: string;
          answer: unknown;
          rubric: unknown;
          status: ReviewItemStatus;
          due_at: unknown | null;
          ease: unknown;
          interval: unknown;
          reps: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `SELECT id, concept_id, type, prompt, answer, rubric, status, due_at, ease, interval, reps, created_at, updated_at
           FROM review_item
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          conceptId: row.concept_id,
          type: row.type,
          prompt: row.prompt,
          answer: row.answer,
          rubric: row.rubric,
          status: row.status,
          dueAt: toNullableNumber(row.due_at),
          ease: toNumber(row.ease),
          interval: toNumber(row.interval),
          reps: toNumber(row.reps),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        };
      },

      async listByConceptId(conceptId: string, limit: number = 50): Promise<ReviewItem[]> {
        const res = await pool.query<{
          id: string;
          concept_id: string | null;
          type: string;
          prompt: string;
          answer: unknown;
          rubric: unknown;
          status: ReviewItemStatus;
          due_at: unknown | null;
          ease: unknown;
          interval: unknown;
          reps: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `SELECT id, concept_id, type, prompt, answer, rubric, status, due_at, ease, interval, reps, created_at, updated_at
           FROM review_item
           WHERE concept_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [conceptId, limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          conceptId: row.concept_id,
          type: row.type,
          prompt: row.prompt,
          answer: row.answer,
          rubric: row.rubric,
          status: row.status,
          dueAt: toNullableNumber(row.due_at),
          ease: toNumber(row.ease),
          interval: toNumber(row.interval),
          reps: toNumber(row.reps),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        }));
      },

      async listDue(asOf: number, limit: number): Promise<ReviewItem[]> {
        const res = await pool.query<{
          id: string;
          concept_id: string | null;
          type: string;
          prompt: string;
          answer: unknown;
          rubric: unknown;
          status: ReviewItemStatus;
          due_at: unknown | null;
          ease: unknown;
          interval: unknown;
          reps: unknown;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `SELECT id, concept_id, type, prompt, answer, rubric, status, due_at, ease, interval, reps, created_at, updated_at
           FROM review_item
           WHERE status = 'active'
             AND concept_id IS NOT NULL
             AND answer IS NOT NULL
             AND rubric IS NOT NULL
             AND type IN ('CLOZE', 'ORDERING_STEPS', 'COMPARE_CONTRAST', 'MECHANISM_TRACE', 'FAILURE_MODE', 'CONTRAST_EXPLAIN', 'CODE_REASONING')
             AND due_at IS NOT NULL
             AND due_at <= $1
           ORDER BY due_at ASC, updated_at ASC, id ASC
           LIMIT $2`,
          [asOf, limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          conceptId: row.concept_id,
          type: row.type,
          prompt: row.prompt,
          answer: row.answer,
          rubric: row.rubric,
          status: row.status,
          dueAt: toNullableNumber(row.due_at),
          ease: toNumber(row.ease),
          interval: toNumber(row.interval),
          reps: toNumber(row.reps),
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        }));
      },

      async grade(input: { id: string; grade: ReviewGrade; now?: number }): Promise<ReviewItem> {
        const now = input.now ?? Date.now();
        const existing = await this.getById(input.id);
        if (!existing) throw new Error(`Review item not found: ${input.id}`);
        if (existing.status !== "active") throw new Error("Review item not active");
        if (!existing.conceptId) throw new Error("Review item missing conceptId");
        if (existing.answer === null || existing.rubric === null) {
          throw new Error("Review item missing content");
        }
        if (!["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST", "MECHANISM_TRACE", "FAILURE_MODE", "CONTRAST_EXPLAIN", "CODE_REASONING"].includes(existing.type)) {
          throw new Error("Review item type unsupported");
        }

        const next = sm2NextSchedule(
          { ease: existing.ease, interval: existing.interval, reps: existing.reps },
          input.grade,
          now
        );

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          await client.query(
            `UPDATE review_item
             SET due_at = $2, ease = $3, interval = $4, reps = $5, updated_at = $6
             WHERE id = $1`,
            [existing.id, next.dueAt, next.ease, next.interval, next.reps, now]
          );

          if (existing.conceptId) {
            const conceptRes = await client.query<{ mastery_score: unknown }>(
              "SELECT mastery_score FROM concept WHERE id = $1 FOR UPDATE",
              [existing.conceptId]
            );
            const prev = toNumber(conceptRes.rows[0]?.mastery_score ?? 0);
            const masteryScore = updateMasteryScore(prev, input.grade);
            await client.query(
              "UPDATE concept SET mastery_score = $2, updated_at = $3 WHERE id = $1",
              [existing.conceptId, masteryScore, now]
            );
          }

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }

        const updated = await this.getById(existing.id);
        if (!updated) throw new Error("Failed to load updated review item");
        return updated;
      }
    },

    draftRevision: {
      async create(input: DraftRevisionCreate): Promise<DraftRevision> {
        const now = Date.now();
        const id = input.id ?? newId("draft_revision");
        const status: DraftRevisionStatus = input.status ?? "draft";

        const res = await pool.query<{
          id: string;
          concept_id: string;
          kind: string;
          status: DraftRevisionStatus;
          before_state: unknown;
          after_state: unknown;
          diff: string;
          created_at: unknown;
          applied_at: unknown | null;
          rejected_at: unknown | null;
        }>(
          `INSERT INTO draft_revision
           (id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at`,
          [id, input.conceptId, input.kind, status, input.before, input.after, input.diff, now, null, null]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create draft revision");
        return toDraftRevision(row);
      },

      async getById(id: string): Promise<DraftRevision | null> {
        const res = await pool.query<{
          id: string;
          concept_id: string;
          kind: string;
          status: DraftRevisionStatus;
          before_state: unknown;
          after_state: unknown;
          diff: string;
          created_at: unknown;
          applied_at: unknown | null;
          rejected_at: unknown | null;
        }>(
          `SELECT id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at
           FROM draft_revision
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return toDraftRevision(row);
      },

      async listByConceptId(conceptId: string, limit: number): Promise<DraftRevision[]> {
        const res = await pool.query<{
          id: string;
          concept_id: string;
          kind: string;
          status: DraftRevisionStatus;
          before_state: unknown;
          after_state: unknown;
          diff: string;
          created_at: unknown;
          applied_at: unknown | null;
          rejected_at: unknown | null;
        }>(
          `SELECT id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at
           FROM draft_revision
           WHERE concept_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [conceptId, limit]
        );
        return res.rows.map((r) => toDraftRevision(r));
      },

      async reject(id: string): Promise<DraftRevision> {
        const now = Date.now();
        const res = await pool.query<{
          id: string;
          concept_id: string;
          kind: string;
          status: DraftRevisionStatus;
          before_state: unknown;
          after_state: unknown;
          diff: string;
          created_at: unknown;
          applied_at: unknown | null;
          rejected_at: unknown | null;
        }>(
          `UPDATE draft_revision
           SET status = 'rejected', rejected_at = $2
           WHERE id = $1 AND status = 'draft'
           RETURNING id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at`,
          [id, now]
        );
        const row = res.rows[0];
        if (!row) {
          const existing = await this.getById(id);
          if (!existing) throw new Error(`Draft revision not found: ${id}`);
          if (existing.status !== "draft") throw new Error("Draft revision is not in draft status");
          throw new Error("Failed to reject draft revision");
        }
        return toDraftRevision(row);
      },

      async apply(id: string): Promise<{ concept: Concept; revision: DraftRevision }> {
        const now = Date.now();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const revRes = await client.query<{
            id: string;
            concept_id: string;
            kind: string;
            status: DraftRevisionStatus;
            before_state: unknown;
            after_state: unknown;
            diff: string;
            created_at: unknown;
            applied_at: unknown | null;
            rejected_at: unknown | null;
          }>(
            `SELECT id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at
             FROM draft_revision
             WHERE id = $1`,
            [id]
          );
          const revRow = revRes.rows[0];
          if (!revRow) throw new Error(`Draft revision not found: ${id}`);
          const revision = toDraftRevision(revRow);

          if (revision.status !== "draft") {
            throw new Error("Draft revision is not in draft status");
          }

          const conceptRes = await client.query<{
            id: string;
            title: string;
            l0: string | null;
            l1: string[] | null;
            l2: string[] | null;
            module: string | null;
            created_at: unknown;
            updated_at: unknown;
          }>(
            `SELECT id, title, l0, l1, l2, module, created_at, updated_at
             FROM concept
             WHERE id = $1`,
            [revision.conceptId]
          );
          const conceptRow = conceptRes.rows[0];
          if (!conceptRow) throw new Error(`Concept not found: ${revision.conceptId}`);

          const currentLevels: SummaryLevels = {
            l1: toStringArray(conceptRow.l1),
            l2: toStringArray(conceptRow.l2)
          };
          if (!sameLevels(currentLevels, revision.before)) {
            throw new Error("CONFLICT: Concept summaries changed since this draft was created");
          }

          const updatedRes = await client.query<{
            id: string;
            title: string;
            kind: NodeKind;
            l0: string | null;
            l1: string[] | null;
            l2: string[] | null;
            module: string | null;
            note_source_id: string | null;
            context: string | null;
            mastery_score: unknown;
            created_at: unknown;
            updated_at: unknown;
          }>(
            `UPDATE concept
             SET l1 = $1, l2 = $2, updated_at = $3
             WHERE id = $4
             RETURNING id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at`,
            [revision.after.l1, revision.after.l2, now, revision.conceptId]
          );
          const updatedRow = updatedRes.rows[0];
          if (!updatedRow) throw new Error("Failed to apply draft revision");

          const appliedRevRes = await client.query<{
            id: string;
            concept_id: string;
            kind: string;
            status: DraftRevisionStatus;
            before_state: unknown;
            after_state: unknown;
            diff: string;
            created_at: unknown;
            applied_at: unknown | null;
            rejected_at: unknown | null;
          }>(
            `UPDATE draft_revision
             SET status = 'applied', applied_at = $2
             WHERE id = $1
             RETURNING id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at`,
            [id, now]
          );
          const appliedRow = appliedRevRes.rows[0];
          if (!appliedRow) throw new Error("Failed to mark draft revision applied");

          await client.query("COMMIT");

          return {
            concept: {
              id: updatedRow.id,
              title: updatedRow.title,
              kind: updatedRow.kind,
              l0: updatedRow.l0,
              l1: toStringArray(updatedRow.l1),
              l2: toStringArray(updatedRow.l2),
              module: updatedRow.module,
              noteSourceId: updatedRow.note_source_id,
              context: updatedRow.context,
              masteryScore: toNumber(updatedRow.mastery_score),
              createdAt: toNumber(updatedRow.created_at),
              updatedAt: toNumber(updatedRow.updated_at)
            },
            revision: toDraftRevision(appliedRow)
          };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },

      async revert(appliedRevisionId: string): Promise<{ concept: Concept; revision: DraftRevision }> {
        const now = Date.now();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const targetRes = await client.query<{
            id: string;
            concept_id: string;
            kind: string;
            status: DraftRevisionStatus;
            before_state: unknown;
            after_state: unknown;
            diff: string;
            created_at: unknown;
            applied_at: unknown | null;
            rejected_at: unknown | null;
          }>(
            `SELECT id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at
             FROM draft_revision
             WHERE id = $1`,
            [appliedRevisionId]
          );
          const targetRow = targetRes.rows[0];
          if (!targetRow) throw new Error(`Draft revision not found: ${appliedRevisionId}`);
          const target = toDraftRevision(targetRow);
          if (target.status !== "applied") {
            throw new Error("Only applied draft revisions can be reverted");
          }

          const conceptRes = await client.query<{
            id: string;
            title: string;
            l0: string | null;
            l1: string[] | null;
            l2: string[] | null;
            module: string | null;
            created_at: unknown;
            updated_at: unknown;
          }>(
            `SELECT id, title, l0, l1, l2, module, created_at, updated_at
             FROM concept
             WHERE id = $1`,
            [target.conceptId]
          );
          const conceptRow = conceptRes.rows[0];
          if (!conceptRow) throw new Error(`Concept not found: ${target.conceptId}`);

          const currentLevels: SummaryLevels = {
            l1: toStringArray(conceptRow.l1),
            l2: toStringArray(conceptRow.l2)
          };
          if (!sameLevels(currentLevels, target.after)) {
            throw new Error("CONFLICT: Concept summaries changed since this revision was applied");
          }

          const updatedRes = await client.query<{
            id: string;
            title: string;
            kind: NodeKind;
            l0: string | null;
            l1: string[] | null;
            l2: string[] | null;
            module: string | null;
            note_source_id: string | null;
            context: string | null;
            mastery_score: unknown;
            created_at: unknown;
            updated_at: unknown;
          }>(
            `UPDATE concept
             SET l1 = $1, l2 = $2, updated_at = $3
             WHERE id = $4
             RETURNING id, title, kind, l0, l1, l2, module, note_source_id, context, mastery_score, created_at, updated_at`,
            [target.before.l1, target.before.l2, now, target.conceptId]
          );
          const updatedRow = updatedRes.rows[0];
          if (!updatedRow) throw new Error("Failed to revert draft revision");

          const revisionId = newId("draft_revision");
          const beforeState: SummaryLevels = target.after;
          const afterState: SummaryLevels = target.before;
          const diff = buildSummaryDiff(beforeState, afterState);

          const newRevRes = await client.query<{
            id: string;
            concept_id: string;
            kind: string;
            status: DraftRevisionStatus;
            before_state: unknown;
            after_state: unknown;
            diff: string;
            created_at: unknown;
            applied_at: unknown | null;
            rejected_at: unknown | null;
          }>(
            `INSERT INTO draft_revision
             (id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, concept_id, kind, status, before_state, after_state, diff, created_at, applied_at, rejected_at`,
            [
              revisionId,
              target.conceptId,
              "revert",
              "applied",
              beforeState,
              afterState,
              diff,
              now,
              now,
              null
            ]
          );
          const newRevRow = newRevRes.rows[0];
          if (!newRevRow) throw new Error("Failed to record revert revision");

          await client.query("COMMIT");

          return {
            concept: {
              id: updatedRow.id,
              title: updatedRow.title,
              kind: updatedRow.kind,
              l0: updatedRow.l0,
              l1: toStringArray(updatedRow.l1),
              l2: toStringArray(updatedRow.l2),
              module: updatedRow.module,
              noteSourceId: updatedRow.note_source_id,
              context: updatedRow.context,
              masteryScore: toNumber(updatedRow.mastery_score),
              createdAt: toNumber(updatedRow.created_at),
              updatedAt: toNumber(updatedRow.updated_at)
            },
            revision: toDraftRevision(newRevRow)
          };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>(
          "SELECT COUNT(1) AS n FROM draft_revision"
        );
        return toNumber(res.rows[0]?.n);
      }
    },

    trainingSession: {
      async create(input: TrainingSessionCreate): Promise<TrainingSession> {
        const now = Date.now();
        const id = input.id ?? newId("ts");

        await pool.query(
          `INSERT INTO training_session
           (id, status, concept_ids, question_count, correct_count, partial_count, wrong_count, started_at, completed_at)
           VALUES ($1, 'active', $2, $3, 0, 0, 0, $4, NULL)`,
          [id, input.conceptIds, input.questionCount ?? 0, now]
        );

        return {
          id,
          status: "active",
          conceptIds: input.conceptIds,
          questionCount: input.questionCount ?? 0,
          correctCount: 0,
          partialCount: 0,
          wrongCount: 0,
          startedAt: now,
          completedAt: null
        };
      },

      async getById(id: string): Promise<TrainingSession | null> {
        const res = await pool.query<{
          id: string;
          status: TrainingSessionStatus;
          concept_ids: string[];
          question_count: unknown;
          correct_count: unknown;
          partial_count: unknown;
          wrong_count: unknown;
          started_at: unknown;
          completed_at: unknown;
        }>(
          `SELECT id, status, concept_ids, question_count, correct_count, partial_count, wrong_count, started_at, completed_at
           FROM training_session WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          status: row.status,
          conceptIds: toStringArray(row.concept_ids),
          questionCount: toNumber(row.question_count),
          correctCount: toNumber(row.correct_count),
          partialCount: toNumber(row.partial_count),
          wrongCount: toNumber(row.wrong_count),
          startedAt: toNumber(row.started_at),
          completedAt: toNullableNumber(row.completed_at)
        };
      },

      async complete(id: string): Promise<TrainingSession> {
        const now = Date.now();
        await pool.query(
          `UPDATE training_session SET status = 'completed', completed_at = $2 WHERE id = $1`,
          [id, now]
        );
        const session = await this.getById(id);
        if (!session) throw new Error(`Training session not found: ${id}`);
        return session;
      },

      async abandon(id: string): Promise<TrainingSession> {
        const now = Date.now();
        await pool.query(
          `UPDATE training_session SET status = 'abandoned', completed_at = $2 WHERE id = $1`,
          [id, now]
        );
        const session = await this.getById(id);
        if (!session) throw new Error(`Training session not found: ${id}`);
        return session;
      },

      async updateCounts(id: string, counts: { correctCount: number; partialCount: number; wrongCount: number }): Promise<void> {
        await pool.query(
          `UPDATE training_session SET correct_count = $2, partial_count = $3, wrong_count = $4 WHERE id = $1`,
          [id, counts.correctCount, counts.partialCount, counts.wrongCount]
        );
      }
    },

    trainingSessionItem: {
      async create(input: TrainingSessionItemCreate): Promise<TrainingSessionItem> {
        const now = Date.now();
        const id = input.id ?? newId("tsi");

        await pool.query(
          `INSERT INTO training_session_item
           (id, session_id, review_item_id, position, user_answer, grade, feedback, graded_at, created_at)
           VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, $5)`,
          [id, input.sessionId, input.reviewItemId, input.position, now]
        );

        return {
          id,
          sessionId: input.sessionId,
          reviewItemId: input.reviewItemId,
          position: input.position,
          userAnswer: null,
          grade: null,
          feedback: null,
          gradedAt: null,
          createdAt: now
        };
      },

      async getById(id: string): Promise<TrainingSessionItem | null> {
        const res = await pool.query<{
          id: string;
          session_id: string;
          review_item_id: string;
          position: unknown;
          user_answer: string | null;
          grade: string | null;
          feedback: string | null;
          graded_at: unknown;
          created_at: unknown;
        }>(
          `SELECT id, session_id, review_item_id, position, user_answer, grade, feedback, graded_at, created_at
           FROM training_session_item WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          sessionId: row.session_id,
          reviewItemId: row.review_item_id,
          position: toNumber(row.position),
          userAnswer: row.user_answer,
          grade: row.grade as TrainingSessionItemGrade | null,
          feedback: row.feedback,
          gradedAt: toNullableNumber(row.graded_at),
          createdAt: toNumber(row.created_at)
        };
      },

      async listBySessionId(sessionId: string): Promise<TrainingSessionItem[]> {
        const res = await pool.query<{
          id: string;
          session_id: string;
          review_item_id: string;
          position: unknown;
          user_answer: string | null;
          grade: string | null;
          feedback: string | null;
          graded_at: unknown;
          created_at: unknown;
        }>(
          `SELECT id, session_id, review_item_id, position, user_answer, grade, feedback, graded_at, created_at
           FROM training_session_item WHERE session_id = $1
           ORDER BY position ASC`,
          [sessionId]
        );
        return res.rows.map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          reviewItemId: row.review_item_id,
          position: toNumber(row.position),
          userAnswer: row.user_answer,
          grade: row.grade as TrainingSessionItemGrade | null,
          feedback: row.feedback,
          gradedAt: toNullableNumber(row.graded_at),
          createdAt: toNumber(row.created_at)
        }));
      },

      async submitAnswer(input: {
        id: string;
        userAnswer: string;
        grade: TrainingSessionItemGrade;
        feedback: string;
      }): Promise<TrainingSessionItem> {
        const now = Date.now();
        await pool.query(
          `UPDATE training_session_item
           SET user_answer = $2, grade = $3, feedback = $4, graded_at = $5
           WHERE id = $1`,
          [input.id, input.userAnswer, input.grade, input.feedback, now]
        );
        const item = await this.getById(input.id);
        if (!item) throw new Error(`Training session item not found: ${input.id}`);
        return item;
      }
    },

    /** MAX(created_at) across concept + edge tables — used for ETag / cache invalidation. */
    async getGraphVersion(): Promise<string> {
      const res = await pool.query<{ v: unknown }>(
        `SELECT GREATEST(
           (SELECT COALESCE(MAX(updated_at), 0) FROM concept),
           (SELECT COALESCE(MAX(created_at), 0) FROM edge)
         ) AS v`
      );
      return String(toNumber(res.rows[0]?.v));
    }
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
