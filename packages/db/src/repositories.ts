import crypto from "node:crypto";

export type Concept = {
  id: string;
  title: string;
  l0: string | null;
  l1: string[];
  module: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ConceptSummary = {
  id: string;
  title: string;
  module: string | null;
};

export type ConceptCreate = {
  id?: string;
  title: string;
  l0?: string | null;
  l1?: string[];
  module?: string | null;
};

export type ConceptUpdate = {
  id: string;
  title?: string;
  l0?: string | null;
  l1?: string[];
  module?: string | null;
};

export type EdgeType =
  | "PREREQUISITE_OF"
  | "PART_OF"
  | "USED_IN"
  | "CONTRASTS_WITH"
  | "ADDRESSES_FAILURE_MODE"
  | "INTRODUCED_BY"
  | "POPULARIZED_BY"
  | "CONFUSED_WITH";

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

export type Chunk = {
  id: string;
  sourceId: string;
  content: string;
  startOffset: number;
  endOffset: number;
  createdAt: number;
};

export type ChunkCreate = {
  id?: string;
  sourceId: string;
  content: string;
  startOffset?: number;
  endOffset?: number;
};

export type ChangesetStatus = "draft" | "applied";

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

export function createRepositories(pool: PgPoolLike) {
  async function getEdgeEvidenceChunkIds(edgeId: string): Promise<string[]> {
    const res = await pool.query<{ chunk_id: string }>(
      "SELECT chunk_id FROM edge_evidence_chunk WHERE edge_id = $1 ORDER BY chunk_id ASC",
      [edgeId]
    );
    return res.rows.map((r) => r.chunk_id);
  }

  return {
    concept: {
      async create(input: ConceptCreate): Promise<Concept> {
        const now = Date.now();
        const id = input.id ?? newId("concept");
        const l1 = input.l1 ?? [];

        const res = await pool.query<{
          id: string;
          title: string;
          l0: string | null;
          l1: string[] | null;
          module: string | null;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `INSERT INTO concept (id, title, l0, l1, module, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, title, l0, l1, module, created_at, updated_at`,
          [id, input.title, input.l0 ?? null, l1, input.module ?? null, now, now]
        );
        const row = res.rows[0];
        if (!row) throw new Error("Failed to create concept");
        return {
          id: row.id,
          title: row.title,
          l0: row.l0,
          l1: toStringArray(row.l1),
          module: row.module,
          createdAt: toNumber(row.created_at),
          updatedAt: toNumber(row.updated_at)
        };
      },

      async getById(id: string): Promise<Concept | null> {
        const res = await pool.query<{
          id: string;
          title: string;
          l0: string | null;
          l1: string[] | null;
          module: string | null;
          created_at: unknown;
          updated_at: unknown;
        }>(
          `SELECT id, title, l0, l1, module, created_at, updated_at
           FROM concept
           WHERE id = $1`,
          [id]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          title: row.title,
          l0: row.l0,
          l1: toStringArray(row.l1),
          module: row.module,
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
        if (hasOwn(input, "module")) {
          sets.push(`module = $${i++}`);
          values.push(input.module ?? null);
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

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM concept");
        return toNumber(res.rows[0]?.n);
      },

      async listSummaries(): Promise<ConceptSummary[]> {
        const res = await pool.query<{ id: string; title: string; module: string | null }>(
          "SELECT id, title, module FROM concept ORDER BY title ASC"
        );
        return res.rows.map((r) => ({ id: r.id, title: r.title, module: r.module }));
      },

      async searchSummaries(q: string, limit: number): Promise<ConceptSummary[]> {
        const query = `%${q}%`;
        const res = await pool.query<{ id: string; title: string; module: string | null }>(
          `SELECT id, title, module
           FROM concept
           WHERE title LIKE $1 OR COALESCE(l0, '') LIKE $1
           ORDER BY title ASC
           LIMIT $2`,
          [query, limit]
        );
        return res.rows.map((r) => ({ id: r.id, title: r.title, module: r.module }));
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

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM source");
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

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM changeset");
        return toNumber(res.rows[0]?.n);
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
      }
    },

    reviewItem: {
      async create(input: ReviewItemCreate): Promise<void> {
        const now = Date.now();
        const id = input.id ?? newId("review_item");
        const status: ReviewItemStatus = input.status ?? "draft";

        await pool.query(
          `INSERT INTO review_item
           (id, concept_id, type, prompt, answer, rubric, status, due_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            input.conceptId ?? null,
            input.type,
            input.prompt,
            typeof input.answer === "undefined" ? null : input.answer,
            typeof input.rubric === "undefined" ? null : input.rubric,
            status,
            input.dueAt ?? null,
            now,
            now
          ]
        );
      },

      async count(): Promise<number> {
        const res = await pool.query<{ n: unknown }>("SELECT COUNT(1) AS n FROM review_item");
        return toNumber(res.rows[0]?.n);
      }
    }
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
