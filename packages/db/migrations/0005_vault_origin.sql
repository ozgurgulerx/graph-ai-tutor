ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'db';

ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS file_path text;

CREATE INDEX IF NOT EXISTS concept_origin_file_idx ON concept(origin, file_path);

ALTER TABLE edge
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'db';

ALTER TABLE edge
  ADD COLUMN IF NOT EXISTS file_path text;

CREATE INDEX IF NOT EXISTS edge_origin_file_idx ON edge(origin, file_path);

