# Graph AI Tutor (LLM Evals + Regression Harness)

## Goal
Prevent "vibes-based" regressions in LLM features (extraction, quizzes, tutor) by enforcing hard gates:
- strict schemas (Structured Outputs)
- deterministic validators
- small fixture-driven evals

## Layered Graders (Required Pattern)
1. Deterministic checks first (always on):
   - JSON schema validity
   - required keys present
   - enums valid
   - id references exist
   - citations/evidence present where required
2. Optional LLM grader second (rare, stable fixtures only):
   - quality/rubric scoring
   - run on a small fixed set to make drift visible

## What Must Be Strict Structured Outputs
- extraction candidates (Concepts/Edges with evidence)
- quiz items (prompt, answer key, rubric, citations)
- grading results (pass/needs_work + rubric notes + citations)
- tutor "used subgraph" payloads (used_concept_ids/used_edge_ids + cited_chunk_ids)

## Fixture Strategy
- Keep fixtures small and stable.
- Store canonical inputs in `fixtures/`:
  - `fixtures/seed.graph.json` as the golden dataset (UI + graph behavior).
  - `fixtures/seed.sources/` for ingestion/chunking/extraction tests.
- For each LLM feature, record:
  - input context (chunks + subgraph)
  - expected invariants (schema validity, evidence rules, id references)

## Expected Commands (Once Implemented)
- `pnpm test` runs deterministic validators on fixtures.
- `pnpm evals` (optional) runs the LLM grader on the same fixtures and stores a summary report.

