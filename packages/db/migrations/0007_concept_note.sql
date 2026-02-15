ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS note_source_id text REFERENCES source(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS concept_note_source_idx ON concept(note_source_id)
  WHERE note_source_id IS NOT NULL;
