-- Indexes for graph traversal queries (BFS, lens, neighborhood)
CREATE INDEX IF NOT EXISTS edge_type_idx ON edge(type);
CREATE INDEX IF NOT EXISTS edge_from_type_idx ON edge(from_concept_id, type);
CREATE INDEX IF NOT EXISTS edge_to_type_idx ON edge(to_concept_id, type);
