-- Lightweight, portable "FTS v1" index for chunks.
--
-- We intentionally avoid Postgres-native tsvector/tsquery here so tests can run
-- on pg-mem (which does not implement full-text search types/functions).
CREATE TABLE IF NOT EXISTS chunk_fts (
  chunk_id text NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  term text NOT NULL,
  PRIMARY KEY (chunk_id, term)
);

CREATE INDEX IF NOT EXISTS chunk_fts_term_idx ON chunk_fts(term);

