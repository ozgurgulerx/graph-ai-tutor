CREATE TABLE IF NOT EXISTS concept (
  id text PRIMARY KEY,
  title text NOT NULL,
  l0 text,
  l1 text[] NOT NULL DEFAULT '{}',
  module text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS source (
  id text PRIMARY KEY,
  url text NOT NULL UNIQUE,
  title text,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS chunk (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  content text NOT NULL,
  start_offset integer NOT NULL DEFAULT 0,
  end_offset integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS edge (
  id text PRIMARY KEY,
  from_concept_id text NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  to_concept_id text NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  type text NOT NULL,
  source_url text,
  confidence double precision,
  verifier_score double precision,
  created_at bigint NOT NULL,
  CONSTRAINT edge_no_self_loop CHECK (from_concept_id <> to_concept_id)
);

CREATE INDEX IF NOT EXISTS edge_from_idx ON edge(from_concept_id);
CREATE INDEX IF NOT EXISTS edge_to_idx ON edge(to_concept_id);

CREATE TABLE IF NOT EXISTS edge_evidence_chunk (
  edge_id text NOT NULL REFERENCES edge(id) ON DELETE CASCADE,
  chunk_id text NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  PRIMARY KEY (edge_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS changeset (
  id text PRIMARY KEY,
  source_id text REFERENCES source(id) ON DELETE SET NULL,
  status text NOT NULL,
  created_at bigint NOT NULL,
  applied_at bigint
);

CREATE TABLE IF NOT EXISTS changeset_item (
  id text PRIMARY KEY,
  changeset_id text NOT NULL REFERENCES changeset(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS changeset_item_changeset_idx ON changeset_item(changeset_id);

CREATE TABLE IF NOT EXISTS review_item (
  id text PRIMARY KEY,
  concept_id text REFERENCES concept(id) ON DELETE SET NULL,
  type text NOT NULL,
  prompt text NOT NULL,
  answer jsonb,
  rubric jsonb,
  status text NOT NULL,
  due_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
