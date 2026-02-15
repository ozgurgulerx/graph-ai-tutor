# Agent Notes (graph-ai-tutor)

This repo is a pnpm + turborepo monorepo for a local-first Concept Knowledge Graph and tutor.

## No-Regression Workflow
- Keep diffs PR-sized and avoid TODOs.
- Quality gates (run before finishing any code change):
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm e2e` (only when UI is touched)

## Database (PostgreSQL)
PostgreSQL is the canonical datastore (dev and prod). SQLite is not used.

- Connection string: `DATABASE_URL`
- Schema + migrations: `packages/db/migrations/*.sql`
- Seed fixture: `fixtures/seed.graph.json`
- Unit tests: use `pg-mem` (no external Postgres required)

### Dev DB (Docker)
`docker compose up -d db`

Default connection string for the compose config in `docker-compose.yml`:
`postgres://graph:graph@localhost:5432/graph_ai_tutor`

### Migrations + Seed
`packages/db` runs migrations automatically on `openDb()`.

Seed helpers live in `packages/db/src/seed.ts`:
- `seedFromFile(db, seedPath)`
- `ensureSeedFromFile(db, seedPath)` (seed only when empty)
