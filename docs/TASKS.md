# Graph-AI-Tutor — Task Queue (v0)

## Working agreement (per task)
- One task = one PR-sized change.
- Main stays runnable (`pnpm dev`).
- Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- If UI touched: `pnpm e2e`.
- If schema/contracts change: add a migration and update `packages/shared`.
- AI output must be a Changeset; nothing writes to the vault without explicit user approval.

Codex prompt wrapper (paste at the top of a task)
```text
Constraints:
- Keep changes minimal and focused to this task.
- Do not break existing behavior; update tests accordingly.
- Run: pnpm lint, pnpm typecheck, pnpm test. If UI touched, pnpm e2e.
- If you change schema/contracts, add a migration and update packages/shared.
Deliver:
- Summary of changes
- Commands run + results
- Manual verification steps
```

## Current baseline (what exists today)
- Postgres schema + migrations for: concept, edge, source, chunk, changeset, changeset_item, review_item.
- API endpoints: `GET /health`, `GET /graph`, `GET /concept/:id`, `POST /concept`, `POST /edge`, `GET /search`.
- Web app: 3-pane shell (left search, center Atlas, right Concept Workspace), graph pan/zoom + edge-type filtering, concept L0/L1 edit.
- Playwright smoke test exists.

## Task queue (PR-sized, ordered)

## Task 1 — Command palette (Cmd+K)
Goal: Add a command palette that can open concepts and kick off primary actions.
Acceptance:
- Cmd+K toggles the palette; Esc closes; Enter runs selected action.
- Actions include: Open concept, Capture, Start training, Review changesets.
- E2E covers “open concept from palette”.

## Task 2 — Right pane “Inspector” structure
Goal: Match the UX spec’s Inspector model (definition/invariants, neighbors, sources/evidence, mastery, actions).
Acceptance:
- Right pane is sectioned (even if some sections are placeholders).
- No regressions to current Concept Workspace editing.

## Task 3 — Manual edge creation UI
Goal: Add a keyboard-first edge editor that can link two concepts with a typed edge.
Acceptance:
- Create an edge from the selected concept to a searched target concept.
- Edge appears in the Atlas without full refresh.
- Tests cover edge creation validation.

## Task 4 — Changesets API + minimal inbox UI (DB-backed)
Goal: Make Changesets reviewable (even before the vault + diffs exist).
Acceptance:
- API supports listing changesets and reading one changeset with its items.
- UI shows an Inbox list + a detail view with accept/reject per item.
- Apply accepted writes graph ops to DB and re-fetches graph.

## Task 5 — Capture (“I learned X…”) store + queue
Goal: Add Capture UI and store captures (as raw inputs) for later LLM processing.
Acceptance:
- Capture accepts plain text and code snippet.
- Captures are visible in a “New / Pending” queue in the left pane.
- No LLM calls yet.

## Task 6 — Vault format + parser (no UI)
Goal: Define the canonical Markdown vault format and parse it deterministically.
Acceptance:
- Add a `vault/` directory with a couple of sample concepts as Markdown files.
- Parser extracts: stable id, title, tags, aliases, typed edges, headings, wiki links.
- Unit tests cover parsing and ID stability.

## Task 7 — Indexer: vault → Postgres rebuild
Goal: Treat Postgres as a rebuildable cache derived from the vault.
Acceptance:
- Add a “rebuild index” path that clears and rebuilds graph/search tables from `vault/`.
- Rebuild is deterministic (same vault -> same DB state).
- Tests cover rebuild on a tiny fixture vault.

## Task 8 — Concept read/write against vault (no AI)
Goal: Make the UI read and edit the canonical Markdown (toggle read/edit).
Acceptance:
- Right pane can render Markdown for a concept and toggle into an editor.
- Saving writes to the underlying vault file and triggers reindex of that concept.
- E2E covers edit-save-reload.

## Task 9 — Universal search (exact) + “why matched”
Goal: Implement fast exact search over vault-derived index with result cards.
Acceptance:
- API supports facets at least by type and tag.
- Result cards show title, type, 1-line summary, and a match snippet/reason.
- Search results appear quickly on the seed vault (budget tracked, not just “feels fast”).

## Task 10 — Changeset patches (unified diff) + apply-to-vault
Goal: Represent vault edits as diffs and apply them only after approval.
Acceptance:
- ChangesetItem can store a unified diff patch targeting one vault file.
- UI shows a diff preview; apply writes to the vault and reindexes.
- Reject stores the decision; no vault change.

## Task 11 — Training data model: review attempts + mastery
Goal: Implement Review (result) and Mastery signals.
Acceptance:
- Add tables for ReviewAttempt and Mastery (migration + shared types).
- API supports: log attempt, fetch due items, update mastery.
- Unit tests cover scheduling state transitions (start with SM-2).

## Task 12 — Training session UI (Recall mode)
Goal: Ship a 10–15 minute Recall session loop.
Acceptance:
- Start session from command palette.
- Answer, grade, and store ReviewAttempt (objective checks where possible).
- Wrong answers link back to the exact concept section used.

## Task 13 — CodeArtifact v1 + lab runner stub
Goal: Add CodeArtifacts and a place to run them.
Acceptance:
- Concept inspector can list CodeArtifacts and open one in the center pane.
- Lab runner can at least render + copy code; “run” can be stubbed behind a disabled button.

## Task 14 — LLM package (Structured Outputs only)
Goal: Add a testable LLM client wrapper without wiring it to UX yet.
Acceptance:
- Central helper for schema-first structured outputs with validation/retry.
- Mocks for unit tests; optional integration test skipped if no key.

## Task 15 — ProposeChangesetFromCapture (LLM) + evidence/hypothesis rules
Goal: Turn Captures into reviewable Changesets that modify graph + vault.
Acceptance:
- LLM output validates strictly.
- Every proposed claim/edge includes evidence (snippet/anchor + source) or is labeled hypothesis.
- Output is stored as a Changeset; applying it updates the vault and reindexes.

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
