# Graph AI Tutor (Architecture Spec)

## Overview
This repository will evolve into a small, testable TypeScript codebase that supports:
- Atlas storage (graph + provenance)
- A 3-pane Atlas UI with focus mode
- Tutor + review loop
- Strict model output handling (Structured Outputs for JSON)

## Implementation Target (Concrete)
App modules (UI)
- Atlas: zoomable graph + focus mode
- Concept Workspace: multi-level summary + mechanism steps + edges + evidence
- Inbox: pending Changesets (PR review for your knowledge graph)
- Tutor: grounded chat (GraphRAG-ish) + "show subgraph used"
- Review: quizzes + spaced repetition + mastery overlay

Backend modules
- Graph store: nodes/edges, evidence pointers
- Source store: URLs/PDFs/text blobs, chunking
- Search: FTS (v1) + embeddings (v2)
- LLM services: extraction/verification/summarization/quiz generation
- Changesets: proposals awaiting approval (the key anti-regression mechanism)

Recommended stack (Codex-friendly)
- Monorepo: pnpm + turborepo
- Web: Vite + React + TypeScript
- Graph viz: Cytoscape.js
- API: Fastify + TypeScript
- DB: Postgres (local via Docker; prod uses the same engine)
- Schema/contracts: Zod shared between FE/BE
- Tests: Vitest (unit), Playwright (e2e)
- LLM API: Responses API (not Assistants)
- Structured outputs: strict Structured Outputs with JSON Schema

## Target Package Layout (Planned)
Monorepo (pnpm workspaces, likely turborepo) layout:
- `apps/web`: Vite + React + TypeScript frontend (3-pane layout, focus mode, Inbox, Tutor, Review)
- `apps/api`: Fastify + TypeScript backend (contract-first, schema-validated IO)
- `packages/shared`: Shared Zod schemas + TypeScript types + typed API client (source of truth)
- `packages/db`: Postgres schema, migrations, repositories
- `packages/llm`: OpenAI Responses API wrapper + routing (nano vs mini) + Structured Outputs helpers
- `packages/ui`: Shared UI components (optional)

## Repo Blueprint (Planned)
This is the expected repo shape (root is the "atlas" project):

```text
apps/
  api/                 # Fastify server
  web/                 # Vite React UI
packages/
  shared/              # Zod schemas, types, api client
  db/                  # Postgres schema + migrations + repository layer
  llm/                 # OpenAI Responses wrapper + prompts + router
docs/
  PRODUCT.md
  UX.md
  ARCHITECTURE.md
  API.md
  EVALS.md
fixtures/
  seed.graph.json      # golden dataset used in tests
  seed.sources/        # small sample docs for ingestion tests
```

## Data Model (Logical)
Core entities (names may map 1:1 to tables/collections):
- Workspace
- Concept (the main node type in the Atlas)
- Edge (relationship between concepts; includes evidence pointers)
- Source (file/url metadata, ingestion settings)
- Chunk (document segments with offsets; used for retrieval/citations)
- Changeset (a proposed batch of graph updates)
- ChangesetItem (one proposed Concept/Edge create/update/delete with evidence)
- ReviewItem (quiz/review objects; used by the SRS loop)
- ReviewAttempt (user answer + feedback + outcome)
- DraftRevision (proposed summary edits with diff, reversible history)

### Invariants in the Data Model
- Nodes/edges that originate from sources must retain provenance to chunks/documents.
- Persisted AI-generated changes are always user-approved proposals (audit-friendly).

### Minimal Property Graph (MVP)
This system is a property graph backed by Postgres tables.

Node types (MVP starts with Concept; others can be added as needed):
- Concept (default)
- MechanismStep (optional; may be modeled as Concepts with a `kind` enum)
- Model, Term/Alias, CodeArtifact, SourceDoc (optional)

Edge types (high-value set; keep enums stable):
- PREREQUISITE_OF
- PART_OF
- USED_IN
- CONTRASTS_WITH
- ADDRESSES_FAILURE_MODE
- INTRODUCED_BY, POPULARIZED_BY
- CONFUSED_WITH (teaching-oriented)

Evidence model (required for trust):
- Every stored edge must reference at least one evidence chunk id.
- Edge evidence fields (shape; storage may be join tables instead of JSON):
  - `evidence_chunk_ids[]`
  - `source_url` (optional convenience; derived from chunks/sources if present)
  - `confidence` (extractor)
  - `verifier_score` (optional)
  - `created_at`

## Ingestion + Retrieval (Planned)
- Source ingestion:
  - capture URL/PDF/text -> store Source + raw content
  - chunk (~800-1200 chars with overlap) -> store Chunks with offsets + provenance
  - index for search (Postgres FTS v1; embeddings via pgvector v2)
- Extraction:
  - extractor proposes Concepts/Edges with evidence chunk ids (Structured Outputs)
  - entity resolution proposes merges/aliases (candidate-only)
  - verifier optionally scores whether evidence supports each claim
  - store output as a Changeset (never auto-apply)
- Tutor query loop (GraphRAG-ish):
  - retrieve chunks (hybrid: keyword + vector)
  - retrieve subgraph (neighbors/k-hop/community)
  - produce answer + citations + "used subgraph" ids (Structured Outputs)

## API Shape (High Level)
The API should remain boring and testable:
- v1 endpoints (baseline):
  - `GET /health`
  - `GET /graph` (nodes + edges for Atlas)
  - `GET /concept/:id`
  - `POST /concept`
  - `POST /edge`
  - `GET /search?q=...` (includes chunk hits once ingestion exists)
- Later endpoints (planned):
  - Source ingestion upload -> chunking -> indexing
  - Changesets: list, inspect, accept/reject items, apply accepted
  - Tutor: grounded Q/A returning structured citations and "used subgraph" ids
  - Review: fetch due items, grade attempts, update schedule

All cross-boundary payloads must be defined in `packages/shared` (Zod) and used by both client and server.

## LLM Integration
### Structured Outputs (Hard Rule)
If the model returns JSON used for application state, it must be:
- Defined by an explicit JSON Schema / Zod schema
- Requested via strict Structured Outputs
- Validated before use; invalid outputs fail closed (no partial state updates)

### OpenAI Client (Responses API)
- Centralize calls in `packages/llm` behind a small interface.
- Provide:
  - A Structured Outputs helper (schema in, typed result out)
  - Mocks for unit tests
  - One optional integration test that is skipped when no API key is set
- Use the Responses API (not Assistants; planned shutdown Aug 26, 2026).

### Model Routing: Nano vs Mini
The system uses two default model tiers:
- `gpt-5-nano`:
  - tagging/classification (module labels, "is this a concept?")
  - cheap summaries (L0/L1)
  - deterministic-ish graders (schema conformance checks, required-key checks)
- `gpt-5-mini`:
  - structured extraction of nodes/edges with evidence
  - entity resolution / merge suggestions
  - quiz generation with explanations/rubrics
  - tutor responses that must be coherent and grounded

Routing policy is deterministic and explainable (rules + telemetry), not learned.

### Hardening Against LLM Regressions
Use layered graders:
1. Deterministic checks first (schema validity, enums, id references, citations present).
2. Optional LLM grader second (quality/rubric) on a small fixed fixture set.

Keep fixtures in `fixtures/` and document the eval harness in `docs/EVALS.md`.

## Storage
Target storage approach:
- Primary DB:
  - Dev: Postgres (local via Docker)
  - Prod: Postgres
  - Migrations are mandatory for schema changes.
- Search/Retrieval:
  - Use Postgres full-text search early; add pgvector later if needed.
- Files:
  - Store imported files and derived artifacts outside git (e.g., `data/`), with clear `.gitignore`.
- Fixtures:
  - Seed graph and source fixtures live under `fixtures/` (used by tests and local dev).
