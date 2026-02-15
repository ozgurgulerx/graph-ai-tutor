CREATE TABLE IF NOT EXISTS vault_file (
  path text PRIMARY KEY,
  content text NOT NULL,
  content_hash text NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_file_updated_idx ON vault_file(updated_at DESC);

