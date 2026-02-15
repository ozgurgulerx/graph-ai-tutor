CREATE TABLE IF NOT EXISTS source_content (
  source_id text PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE,
  content text NOT NULL,
  content_hash text NOT NULL,
  content_type text,
  fetched_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS source_content_hash_idx ON source_content(content_hash);
