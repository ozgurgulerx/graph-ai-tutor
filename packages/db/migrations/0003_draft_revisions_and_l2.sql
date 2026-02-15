ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS l2 text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS draft_revision (
  id text PRIMARY KEY,
  concept_id text NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  diff text NOT NULL,
  created_at bigint NOT NULL,
  applied_at bigint,
  rejected_at bigint,
  CONSTRAINT draft_revision_status_check CHECK (status IN ('draft', 'applied', 'rejected'))
);

CREATE INDEX IF NOT EXISTS draft_revision_concept_idx ON draft_revision(concept_id);
CREATE INDEX IF NOT EXISTS draft_revision_concept_created_idx
  ON draft_revision(concept_id, created_at DESC);

