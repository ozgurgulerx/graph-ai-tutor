# Evals-lite (LLM Regression Harness)

## Goal
Make LLM output drift visible without requiring live model calls in CI.

## Layered Grader Approach
1. Deterministic validators (always on, CI-friendly)
   - schema validity
   - id/reference integrity (concept ids, chunk ids, used subgraph ids)
   - citation presence and citation id coverage
2. Optional LLM grader (manual)
   - rubric-style scoring using a cheap model tier (nano)
   - stores scored reports under `evals/results/`

## Fixtures
Recorded fixtures live in `fixtures/evals/*.json`.

Each fixture includes:
- `input`: the canonical prompt context (chunks/graph/concept)
- `output`: a recorded model output
- `expect`: invariants that must remain true

## Commands
- `pnpm evals` (deterministic fixture validation)
- `pnpm evals:grade` (optional; requires `OPENAI_API_KEY`, writes a report to `evals/results/`)

## Updating/Adding Fixtures
1. Add a new `fixtures/evals/<feature>.<name>.json`.
2. Keep inputs and outputs small and stable.
3. Ensure `pnpm evals` passes.

