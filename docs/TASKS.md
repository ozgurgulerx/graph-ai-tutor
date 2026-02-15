# Graph AI Tutor (Task Plan)

## 0) Codex Operating Model (How We'll Drive Codex)
Goal: ship a small IDE with hard regression gates, as a sequence of tiny vertical slices. After every task, the app runs, tests are green, and you can keep using it while it grows.

Workflow that prevents regressions
- One Codex task = one PR-sized change (<= ~10 files touched unless unavoidable).
- Main branch is always runnable (`pnpm dev` works; seed data loads).
- Every code task adds/adjusts tests (unit + at least one e2e smoke).
- No schema drift: DB schema + API contracts change only with migrations + type updates.
- LLM features are candidate-only first (nothing auto-edits your graph without approval).

Worktrees/threads (optional but ideal)
- Run backend and frontend work in separate worktrees/threads to avoid conflicts; merge sequentially through PRs.

Create a "No-Regression" Codex Skill (do this once)
- Skill: `no-regression-webapp`
- Skill source (this repo): `codex-skills/no-regression-webapp` (copy to `~/.codex/skills/no-regression-webapp` and restart Codex to pick it up).
- Always run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm e2e` (when UI touched).
- Don't change DB schema without a migration.
- Don't change API response shapes without updating `packages/shared` schemas (and regenerating the client, if generated).
- Don't introduce TODOs.
- Summarize: files changed + commands run + results.

Codex prompt wrapper (paste at the top of every task prompt)
```text
Use the no-regression-webapp skill.
Constraints:
- Keep changes minimal and focused to the requested task.
- Do not break existing behavior; update tests accordingly.
- Run: pnpm lint, pnpm typecheck, pnpm test. If UI touched, pnpm e2e.
- If you need to change schemas, add migrations and update shared types.
Deliver:
- Summary of changes
- Commands run + outputs
- How to verify manually
```

Two contrarian tricks that reduce errors massively
- Changesets everywhere (not just LLM extraction): even manual edits can be staged as a draft changeset before applying.
- Treat your knowledge graph like code: edges have evidence, changes are reviewed, quizzes are unit tests, mastery overlay is coverage.

## Operating Rules
- One task per request (PR-sized). Keep the diff small.
- No regressions: do not break existing behavior.
- If changing DB schema: add migration + update shared Zod schemas/types.
- Do not auto-commit LLM outputs: everything must go through Changesets and manual approval.
- Use strict Structured Outputs for all LLM JSON.

## Quality Gates
- Run: pnpm lint, pnpm typecheck, pnpm test
- If UI touched: pnpm e2e

## Deliverables (In Each Response)
- Summary of changes
- Files changed
- Commands run + results
- Manual verification steps

## 24-Step Plan (Ordered)

## Task 1 - Scaffold monorepo + tooling
Goal: Create the workspace, scripts, lint/test/typecheck baseline.

Acceptance gates
- `pnpm -r test` passes (even if only a trivial test)
- `pnpm -r lint` passes
- `pnpm -r typecheck` passes
- `pnpm dev` runs web + api concurrently

Codex prompt
Scaffold a pnpm + turborepo monorepo with:
- apps/web: Vite + React + TS
- apps/api: Fastify + TS
- packages/shared: Zod + TS types
Add lint/typecheck/test scripts, and a root `pnpm dev` that runs web+api.
Add one trivial Vitest test per app to verify wiring.
Do not add TODOs. Run all scripts and report results.

## Task 2 - Write the "Spec Pack" docs (Codex-readable)
Goal: Freeze product intent so Codex stops improvising.

Acceptance gates
- `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md` exist
- Docs describe primary screens + flows + invariants

Codex prompt
Create `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md` describing:
- Screens: Atlas, Concept Workspace, Inbox, Tutor, Review
- Data entities: Concept, Edge, Source, Chunk, Changeset, ReviewItem
- Invariants: changesets only; no auto-commits to graph
Keep it concise but precise. No code changes besides docs.

## Task 3 - Postgres schema + migrations (db package)
Goal: Implement stable storage for graph + sources + changesets.

Acceptance gates
- Migration runs on startup
- Seed loads
- Unit tests for basic CRUD

Codex prompt
Implement `packages/db` with Postgres schema + migrations for:
Concept, Edge, Source, Chunk, Changeset, ChangesetItem, ReviewItem.
Include a seed loader from `fixtures/seed.graph.json`.
Expose repository methods with TypeScript types.
Add Vitest tests for create/read/update and referential integrity.

## Task 4 - API v1 (contract-first)
Goal: Expose minimal endpoints using shared Zod schemas.

Endpoints
- `GET /health`
- `GET /graph` (nodes+edges for atlas)
- `GET /concept/:id`
- `POST /concept`
- `POST /edge`
- `GET /search?q=`

Acceptance gates
- API integration tests
- Shared schemas compile

Codex prompt
Implement `apps/api` routes using Zod schemas from `packages/shared`.
Add endpoints: `/health`, `/graph`, `/concept/:id`, `POST /concept`, `POST /edge`, `/search`.
Use repositories from `packages/db`.
Add API tests (supertest or fetch-based) for all routes.

## Task 5 - Web shell UI (3-pane layout)
Goal: Layout + routing + state wiring.

Acceptance gates
- App loads with seed graph
- Basic navigation works
- Playwright smoke test passes

Codex prompt
Implement `apps/web` layout:
- Left: Search + nav
- Center: Atlas placeholder
- Right: Concept panel placeholder
Wire to API `/graph` and `/concept/:id` using a typed client in `packages/shared`.
Add Playwright e2e: loads home, sees at least one node label.

## Task 6 - Atlas graph viewer (Cytoscape)
Goal: Actual visual learning surface.

Behaviors
- zoom/pan
- click node to open Concept panel
- filter edges by type

Acceptance gates
- e2e: click a node opens concept title in right panel

Codex prompt
Add Cytoscape.js atlas in center pane.
Render nodes/edges from `/graph`.
On node click, fetch concept and show in right panel.
Add edge-type filter UI.
Add Playwright test: click first node -> concept title visible.

## Task 7 - Concept Workspace v1 (view + edit L0/L1)
Goal: Make concepts editable without LLM.

Acceptance gates
- edit/save round-trip
- no graph breakage

Codex prompt
Implement Concept Workspace tab in right panel:
- Show title, L0 one-liner, L1 bullets
- Edit + save via API
Add unit tests for form validation + API.
Add e2e: edit L0, save, reload, persists.

## Task 8 - Edge editor (manual graph edits)
Goal: You can connect concepts yourself.

Acceptance gates
- adding edge updates atlas without refresh

Codex prompt
Add UI to create an Edge between two concepts:
- Select source concept (current) and target concept (search)
- Choose edge type enum
POST `/edge` and update atlas state.
Add tests for edge creation.

## Task 9 - Sources v1 (manual attach + evidence stub)
Goal: Start building "evidence-grounded" workflow before LLM exists.

Acceptance gates
- can attach a Source URL to a Concept
- evidence record shows up in UI

Codex prompt
Implement Source entity UI:
- Add Source (url, title optional)
- Attach Source to Concept (Evidence pointer)
No chunking yet.
Add API endpoints and UI. Tests required.

## Task 10 - Chunking pipeline (local docs)
Goal: Ingest text/PDF/markdown into chunks.

Acceptance gates
- upload -> source saved -> chunks created
- chunks searchable via FTS

Codex prompt
Add ingestion endpoint:
- Upload text/markdown/PDF (store file + metadata)
- Create Source record
- Chunk into ~800-1200 char chunks with overlap
- Store Chunk records and build Postgres FTS index
Add `/search` that includes chunk hits.
Add tests using `fixtures/seed.sources`.

## Task 11 - LLM client wrapper (Responses API)
Goal: Centralize all OpenAI calls + make them testable.

Acceptance gates
- One integration test that can be skipped if no key
- Schema-based structured output helper exists

Codex prompt
Implement `packages/llm`:
- OpenAI Responses API wrapper
- model router (nano vs mini)
- helper for Structured Outputs with JSON Schema
Add mocks for unit tests and one optional integration test.
Document env vars in README.

## Task 12 - Structured extraction: propose nodes/edges (Changeset-only)
Goal: LLM produces candidates, not commits.

Acceptance gates
- extraction produces a Changeset + items
- items reference chunk ids as evidence
- strict schema validation enforced

Codex prompt
Implement extraction job:
Input: `source_id`
Process: retrieve chunks -> call LLM (gpt-5-mini) to propose Concepts+Edges
Output: store as Changeset with ChangesetItems referencing evidence `chunk_ids`
Use Structured Outputs strict schema.
Add deterministic validators: ids exist, enums valid, no self-loop edges.
Tests required (LLM mocked).

## Task 13 - Inbox UI (review changesets like PRs)
Goal: You approve/merge candidates.

Acceptance gates
- list changesets
- inspect items
- accept/reject item
- apply accepted commits to graph

Codex prompt
Create Inbox screen:
- list changesets
- open a changeset -> view proposed nodes/edges with evidence chunks
- per-item accept/reject
- apply accepted -> writes to Concept/Edge tables and marks changeset applied
Add e2e: apply a changeset adds a node visible on atlas.

## Task 14 - Evidence viewer (edge -> supporting chunks)
Goal: Click any edge, see its evidence.

Acceptance gates
- evidence panel shows chunk text + source link

Codex prompt
Implement evidence viewer:
- selecting an edge shows associated chunk texts and source metadata
- ensure edges store `evidence_chunk_ids[]`
Add tests + e2e: click edge -> evidence appears.

## Task 15 - Tutor v1 (grounded Q/A from graph + chunks)
Goal: Ask questions; tutor cites chunks; shows subgraph used.

Acceptance gates
- tutor response includes citation ids
- used nodes/edges list returned in structured output

Codex prompt
Add Tutor tab:
- Input question
- Backend: retrieve top chunks via FTS + graph neighborhood around matched concepts
- Call LLM (gpt-5-mini) to answer with structured output:
  `{ answer_markdown, cited_chunk_ids[], used_concept_ids[], used_edge_ids[] }`
- UI highlights used nodes in atlas and shows citations.
Add tests with mocked LLM.

## Task 16 - Distillation (multi-level summaries with diff)
Goal: LLM proposes edits; you accept.

Acceptance gates
- generates proposal diff
- accept applies to L1/L2 only
- always reversible (history)

Codex prompt
Implement Distill action:
- LLM proposes updates for L1/L2 summaries using evidence chunks
- Store as DraftRevision with diff
- UI shows diff and accept/reject
- Keep revision history per concept
Tests required.

## Task 17 - Quiz schema + generator (Graph-native quiz types)
Goal: Create quizzes per concept with strict outputs.

Acceptance gates
- quiz items saved + rendered
- supports at least 3 types: cloze, ordering, compare

Codex prompt
Implement quiz generation:
- For a `concept_id`, call LLM (nano for draft, mini for finalize) with strict schema
- Types: CLOZE, ORDERING_STEPS, COMPARE_CONTRAST
Store ReviewItems with answer key + rubric.
Add UI to preview quizzes.
Tests required with mocked LLM.

## Task 18 - SRS scheduler + Review screen
Goal: Daily review loop.

Acceptance gates
- due items selected deterministically
- grading updates scheduling
- mastery score updates per concept

Codex prompt
Implement spaced repetition:
- Schedule fields on ReviewItem (due_at, ease, interval, reps)
- Review screen: fetch due items, show, grade (correct/partial/wrong)
- Update schedule using SM-2 style logic
- Update mastery_score per concept
Add unit tests for scheduling logic.

## Task 19 - Mastery overlay on Atlas
Goal: Visual learning feedback.

Acceptance gates
- node styling reflects mastery buckets
- toggle overlay

Codex prompt
Add mastery overlay:
- fetch mastery_score per concept
- apply visual styling on atlas nodes (3 buckets)
- toggle on/off
Add e2e: toggle changes DOM class on nodes.

## Task 20 - Learning paths (prereq chain + "next concepts")
Goal: Navigation that feels like a curriculum.

Acceptance gates
- Path view shows topological prereq list
- recommends next based on mastery gaps

Codex prompt
Implement Learning Paths:
- compute prereq chain via PREREQUISITE_OF edges
- show ordered list for current concept
- recommend next concepts with low mastery among dependents
Tests for path ordering and cycle detection.

## Task 21 - Entity resolution / merge duplicates (safe + reversible)
Goal: Stop synonym explosions.

Acceptance gates
- merge preview
- merge creates redirects / alias mapping
- reversible

Codex prompt
Implement concept merge:
- choose canonical + duplicates
- move edges, preserve old ids as aliases
- update references in evidence and review items
- keep merge history for undo
Add tests for edge rewiring correctness.

## Task 22 - Crawler v1 (allowlist + dedupe + changesets)
Goal: "Continuously enrich" without trashing signal.

Acceptance gates
- allowlist enforced
- content hash dedupe
- ingestion produces changeset (never auto-commit)

Codex prompt
Add crawler:
- allowlist domains config
- fetch URL -> store Source + raw content
- dedupe by normalized URL + content hash
- run chunking + extraction into a Changeset
Add tests for allowlist and dedupe.

## Task 23 - Regression harness for LLM behaviors (Evals-lite)
Goal: Make LLM output drift visible.

Acceptance gates
- a test suite that runs deterministic validators on recorded fixtures
- optional LLM grader script runnable manually

Codex prompt
Create `EVALS.md` + a regression harness:
- deterministic checks: schema validity, id references, citation presence
- record a small set of fixture inputs/expected invariants
- optional script to run LLM grader (nano) and store scores
Follow layered grader approach. Add CI-friendly commands.

## Task 24 - Packaging (optional)
Goal: Make it a "local app" experience.

Acceptance gates
- one-command start
- data stored locally

Codex prompt
Add a packaging option:
- either Tauri or Electron, or a single `pnpm start` that runs api+web
- ensure `DATABASE_URL` is local and configurable
Document install/run steps.
Do not break existing dev workflow.
