import type { PgPoolLike } from "./repositories";

const EXTENSIONS = ["vector", "ltree", "pg_trgm"] as const;
const EXTENSION_INDEX_STATEMENTS = [
  // ltree: accelerate prefix/subtree queries for hierarchical IDs.
  "CREATE INDEX IF NOT EXISTS concept_id_ltree_idx ON concept USING gist (text2ltree(id));",
  // pg_trgm: accelerate fuzzy search over titles.
  "CREATE INDEX IF NOT EXISTS concept_title_trgm_idx ON concept USING gin (title gin_trgm_ops);",
  // Full-text search indexes (optional; ignored in pg-mem).
  `CREATE INDEX IF NOT EXISTS concept_fts_idx ON concept USING gin (
     (setweight(to_tsvector('english', coalesce(title, '')), 'A')
      || setweight(to_tsvector('english', coalesce(l0, '')), 'B')
      || setweight(to_tsvector('english', array_to_string(l1, ' ')), 'C')
      || setweight(to_tsvector('english', array_to_string(l2, ' ')), 'D'))
   );`,
  `CREATE INDEX IF NOT EXISTS chunk_fts_idx ON chunk USING gin (
     to_tsvector('english', content)
   );`
] as const;

export async function ensureExtensions(pool: PgPoolLike): Promise<void> {
  for (const ext of EXTENSIONS) {
    try {
      // Extensions are optional for tests (pg-mem) and some hosted Postgres instances.
      await pool.query(`CREATE EXTENSION IF NOT EXISTS ${ext};`);
    } catch (err) {
      // pg-mem doesn't support CREATE EXTENSION, and some environments restrict it.
      void err;
    }
  }
}

export async function ensureExtensionIndexes(pool: PgPoolLike): Promise<void> {
  for (const stmt of EXTENSION_INDEX_STATEMENTS) {
    try {
      await pool.query(stmt);
    } catch (err) {
      // If an extension isn't installed/available, the opclass/functions won't exist.
      void err;
    }
  }
}
