ALTER TABLE concept
  ADD COLUMN IF NOT EXISTS mastery_score double precision NOT NULL DEFAULT 0;

ALTER TABLE review_item
  ADD COLUMN IF NOT EXISTS ease double precision NOT NULL DEFAULT 2.5;

ALTER TABLE review_item
  ADD COLUMN IF NOT EXISTS interval integer NOT NULL DEFAULT 0;

ALTER TABLE review_item
  ADD COLUMN IF NOT EXISTS reps integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS review_item_due_idx
  ON review_item (status, due_at, id);
