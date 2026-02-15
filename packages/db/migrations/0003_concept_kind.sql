ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'Concept';

CREATE INDEX IF NOT EXISTS concept_kind_idx ON concept(kind);

