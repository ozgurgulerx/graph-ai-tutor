CREATE TABLE IF NOT EXISTS training_session (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'active',
  concept_ids text[] NOT NULL DEFAULT '{}',
  question_count int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  partial_count int NOT NULL DEFAULT 0,
  wrong_count int NOT NULL DEFAULT 0,
  started_at bigint NOT NULL,
  completed_at bigint
);

CREATE TABLE IF NOT EXISTS training_session_item (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES training_session(id) ON DELETE CASCADE,
  review_item_id text NOT NULL REFERENCES review_item(id) ON DELETE CASCADE,
  position int NOT NULL,
  user_answer text,
  grade text,
  feedback text,
  graded_at bigint,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS training_session_item_session_idx ON training_session_item(session_id);
CREATE INDEX IF NOT EXISTS training_session_status_idx ON training_session(status, started_at);
