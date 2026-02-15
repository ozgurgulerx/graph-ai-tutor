CREATE TABLE IF NOT EXISTS concept_source (
  concept_id text NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  PRIMARY KEY (concept_id, source_id)
);

CREATE INDEX IF NOT EXISTS concept_source_concept_idx ON concept_source(concept_id);
CREATE INDEX IF NOT EXISTS concept_source_source_idx ON concept_source(source_id);

