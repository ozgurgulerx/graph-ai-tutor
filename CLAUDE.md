# CLAUDE.md — graph-ai-tutor

## Project Overview

Local-first knowledge graph + AI tutor. Users capture sources, extract concepts/edges via LLM, then study with spaced repetition and an AI tutor. The graph is visualized with Cytoscape.js.

## Monorepo Layout

```
apps/
  api/          @graph-ai-tutor/api    Fastify REST server (tsx, port 3000)
  web/          @graph-ai-tutor/web    React + Vite SPA (port 5173)
packages/
  db/           @graph-ai-tutor/db     PostgreSQL (pg), migrations, repositories
  shared/       @graph-ai-tutor/shared Zod schemas, types, API client
  llm/          @graph-ai-tutor/llm    OpenAI wrapper, structured output
e2e/            Playwright specs
fixtures/       seed.graph.json
vault/          Markdown concept files (local-first)
scripts/        start-local.cjs, evals, seed builders
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, Cytoscape.js, CodeMirror 6 |
| Backend | Fastify 4, tsx (dev runner) |
| Database | PostgreSQL 16 + pgvector, raw SQL via `pg` (no ORM) |
| Validation | Zod everywhere (shared schemas) |
| LLM | OpenAI API (gpt-5-nano/mini) via `@graph-ai-tutor/llm` |
| Tests | Vitest (unit), Playwright (e2e), pg-mem (in-memory PG) |
| Monorepo | pnpm 10 + Turborepo |

## Commands

```bash
pnpm start           # Full local stack: docker db + api + web
pnpm dev             # API + Web dev servers (db must be running)
pnpm db:up           # Start PostgreSQL container
pnpm db:down         # Stop PostgreSQL container

pnpm lint            # ESLint all packages
pnpm typecheck       # TypeScript check all packages
pnpm test            # Vitest unit tests all packages
pnpm e2e             # Playwright end-to-end tests

# Per-package (from root)
pnpm --filter @graph-ai-tutor/api test
pnpm --filter @graph-ai-tutor/web typecheck
```

## Quality Gates — Run Before Finishing Any Change

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm e2e` (when UI is touched)

Keep diffs PR-sized. Avoid TODOs.

## Architecture Patterns

### API (apps/api)
- **Feature modules**: `capture/`, `distill/`, `training/`, `tutor/`, `extraction/`, `watcher/`, `indexer/`, `changesets/`
- Each module: `index.ts` (routes), `schema.ts` (Zod), `llm.ts`, `job.ts`
- **DI via `ServerDeps`**: repos, LLM clients, vaultRoot, eventBus
- **Validation**: `parseOr400()` + `sendError()` helpers
- Routes registered under `/api/*` prefix

### Database (packages/db)
- Raw SQL queries (no ORM). Repository pattern: `repos.concepts`, `repos.edges`, etc.
- Migrations: `packages/db/migrations/*.sql` (numbered, auto-run on `openDb()`)
- Unit tests use `pg-mem` (no Docker needed)
- Docker: `pgvector/pgvector:pg16` on port 5433, user/pass `graph/graph`, db `graph_ai_tutor`

### Frontend (apps/web)
- Single `App.tsx` is the main shell (~1500 lines, three-panel layout)
- Graph rendering: `AtlasView` component wraps Cytoscape
- Styling: single `main.css` file, plain CSS classes (no CSS-in-JS)
- API calls: `apps/web/src/api/client.ts` with caching helpers
- Vite proxies `/api` to `http://127.0.0.1:3000`

### Shared (packages/shared)
- All Zod schemas + inferred TypeScript types
- `createApiClient()` factory
- Graph algorithms: `computePrerequisitePath()`, `computeGraphLens()`

## Code Conventions

- **ESM everywhere** (`"type": "module"`)
- **Strict TypeScript** (strict: true, no implicit any)
- **File naming**: kebab-case files, PascalCase components/types, camelCase functions
- **Import order**: node: builtins → external → @graph-ai-tutor/* → local
- **Type imports**: use `import type { ... }` when importing only types
- **Constants**: UPPER_SNAKE_CASE
- **Tests**: colocated `*.test.ts` files next to implementation
- **E2E selectors**: `data-testid` and `aria-label` attributes
- **No CSS-in-JS**: all styles in `apps/web/src/main.css`

## Key Files

| File | Purpose |
|---|---|
| `apps/web/src/App.tsx` | Main UI shell, AtlasView, three-panel layout |
| `apps/web/src/main.css` | All application styles |
| `apps/web/src/api/client.ts` | Frontend API client |
| `apps/web/src/usePanelResize.ts` | Draggable panel divider hook |
| `apps/api/src/server.ts` | Fastify server builder + route registration |
| `apps/api/src/index.ts` | Entry point (env, db, seed, start) |
| `packages/db/src/open.ts` | Database connection + migration runner |
| `packages/shared/src/index.ts` | All shared types/schemas |
| `fixtures/seed.graph.json` | Seed data for dev/test |

## Environment

```bash
DATABASE_URL=postgres://graph:graph@localhost:5433/graph_ai_tutor
HOST=127.0.0.1
PORT=3000
GRAPH_AI_TUTOR_VAULT_DIR=./vault
OPENAI_API_KEY=...
OPENAI_MODEL_NANO=gpt-5-nano
OPENAI_MODEL_MINI=gpt-5-mini
```

## Common Pitfalls

- Port 5173 or 3000 already in use: kill existing process or check `lsof -i :PORT`
- E2E tests use pg-mem (no Docker), single worker, no parallelism
- `pnpm start` requires Docker Desktop running (for PostgreSQL)
- Vite `--strictPort` means the web dev server fails if port 5173 is taken
- Cytoscape needs `cy.resize()` after container size changes (ResizeObserver handles this)
- The `.shell` grid has 5 columns (including 2 divider columns) — not 3
