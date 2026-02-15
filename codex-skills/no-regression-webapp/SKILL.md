---
name: no-regression-webapp
description: Enforce a no-regression workflow for this local-first TypeScript webapp repo. Use for any task that changes code or tests: keep the diff PR-sized, run pnpm lint/typecheck/test (and pnpm e2e when UI is touched), require migrations for DB schema changes, update packages/shared Zod schemas for API contract changes, forbid TODOs, and report files changed plus commands/results and manual verification steps.
---

# No Regression Webapp

## Execution Checklist
- Keep the change PR-sized (prefer <= ~10 files touched).
- Keep main runnable: `pnpm dev` works and seed data loads.
- Add/adjust tests for the change:
  - unit tests (Vitest)
  - at least one e2e smoke when UI is touched (Playwright)
- Run quality gates:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm e2e` (when UI is touched)
- Do not introduce TODOs.

## Contract and Schema Rules
- Do not change DB schema without:
  - a migration
  - updated shared Zod schemas/types (in `packages/shared`)
  - updated tests/fixtures as needed
- Do not change API response shapes without:
  - updating `packages/shared` request/response schemas
  - updating the typed client (if generated)

## LLM Output Rules
- If model output is consumed as JSON, use strict Structured Outputs with a schema and validate before use.
- LLM-generated changes are candidate-only first: proposals must go to Changesets and require explicit user approval to apply.

## Response Template (Always Include)
- Summary of changes
- Files changed
- Commands run + results
- Manual verification steps

