# Graph AI Tutor (Product Spec)

## What It Is
Graph AI Tutor is a local-first "Concept Knowledge Graph + GraphRAG tutor".

Sources become chunked evidence. Evidence becomes an Atlas (a concept graph). The Atlas becomes an IDE-like learning workspace: a zoomable map plus a tutor that can explain, compare, generate exercises, and always show "why" via citations back to source chunks.

## First Principles
- The graph is the spine (your externalized mental model).
- Chunks are the ground truth (what claims must cite).
- The LLM is a builder/tutor, not the database.

## Who It's For
- Learners who want to understand a domain via connected concepts, not linear notes.
- Builders who want a graph-first way to curate knowledge with an AI tutor, without letting the AI silently rewrite truth.

## Core Use Cases
- Import sources, derive an Atlas (nodes/edges + citations to chunks).
- Explore the Atlas, focus on one concept, and ask questions grounded in selected context.
- Turn learning into a review loop (questions, answers, feedback, spaced repetition style queues).

## Primary Screens
- Atlas (3-pane): search/nav + graph + right-side workspace panel
- Concept Workspace: view/edit concept summaries
- Inbox: review and apply Changesets (like PRs)
- Tutor: grounded Q/A with citations
- Review: spaced repetition queue and grading

## Key Data Entities
- Concept, Edge
- Source, Chunk
- Changeset, ChangesetItem
- ReviewItem

## Non-Goals
- A general-purpose note-taking app (the Atlas is primary; notes support it).
- Autonomous content authoring (no silent "AI decided" modifications to the Atlas).
- Real-time collaborative editing (until explicitly designed).
- "Magic" correctness: the system must show provenance/citations rather than claiming authority.

## Invariants (Hard Rules)
- One task per request (PR-sized). Keep the diff small.
- No regressions: do not break existing behavior.
- Main branch is always runnable (at minimum: `pnpm dev` works; seed data loads).
- Every code task adds/adjusts tests (unit + at least one e2e smoke). Docs-only tasks are the exception.
- If changing DB schema: add migration + update shared Zod schemas/types.
- Do not change API response shapes without updating `packages/shared` schemas (and the typed client, if generated).
- Do not introduce TODOs.
- LLM features are candidate-only first:
  - Nothing auto-edits your graph without your approval.
  - Ingestion/extraction outputs are stored as Changesets you can review/apply.
- Do not auto-commit LLM outputs: everything must go through Changesets and manual approval.
- Use strict Structured Outputs for all LLM JSON.
- Evidence required:
  - Graph: no edge is stored unless it references at least one evidence chunk id.
  - Code: any behavior change or bug fix must cite evidence (failing test, reproducible steps, log snippet, UX report, or benchmark).
- Quality gates:
  - Run: pnpm lint, pnpm typecheck, pnpm test
  - If UI touched: pnpm e2e
- Deliverables (per task response):
  - Summary of changes
  - Files changed
  - Commands run + results
  - Manual verification steps

## Success Metrics (Early)
- Users can import sources and see an Atlas with traceable citations.
- Users can complete a "review loop" session and see measurable progress.
- The system is predictable: actions are reviewable, and AI writes are never silently persisted.
