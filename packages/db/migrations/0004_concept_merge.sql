CREATE TABLE IF NOT EXISTS concept_merge (
  id text PRIMARY KEY,
  canonical_id text NOT NULL REFERENCES concept(id) ON DELETE RESTRICT,
  duplicate_ids text[] NOT NULL,
  details jsonb NOT NULL,
  created_at bigint NOT NULL,
  undone_at bigint
);

CREATE INDEX IF NOT EXISTS concept_merge_canonical_idx ON concept_merge(canonical_id);
CREATE INDEX IF NOT EXISTS concept_merge_created_idx ON concept_merge(created_at DESC);

CREATE TABLE IF NOT EXISTS concept_alias (
  alias_id text PRIMARY KEY,
  canonical_id text NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  merge_id text REFERENCES concept_merge(id) ON DELETE CASCADE,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS concept_alias_canonical_idx ON concept_alias(canonical_id);
