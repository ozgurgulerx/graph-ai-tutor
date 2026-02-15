# graph-ai-tutor

## Local app start (persistent)
Prereqs:
- Docker Desktop (for Postgres)
- Node + pnpm

Start everything (db + api + web) with one command:
```bash
pnpm start
```

Then open:
- Web: `http://localhost:5173`
- API health: `http://127.0.0.1:3000/health`

Data is stored locally in Docker volume `graph_ai_tutor_pg` (see `docker-compose.yml`).

Optional: store Postgres data in a local folder (instead of a Docker named volume) by setting:
```bash
GRAPH_AI_TUTOR_PGDATA=./data/postgres
```

Stop the database:
```bash
pnpm db:down
```

## Env vars

See `.env.example` for local development configuration.

- `DATABASE_URL`
- `HOST`
- `PORT`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL_NANO`
- `OPENAI_MODEL_MINI`
