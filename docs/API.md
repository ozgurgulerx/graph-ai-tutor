# Graph AI Tutor (API Spec)

## Principles
- Contract-first: define request/response payloads in `packages/shared` (Zod) and reuse on both server and client.
- Boring HTTP: keep endpoints simple and testable.
- Local-first: no auth in v1; assume localhost usage.
- No silent shape drift: API response shape changes require schema updates and tests.

## Error Shape (v1)
All non-2xx responses should use a consistent JSON shape:
```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable summary",
    "details": {}
  }
}
```

## Endpoints (v1 Baseline)
- `GET /health`
  - Returns `{ ok: true }` (or similar) for smoke tests.
- `GET /graph`
  - Returns nodes + edges for the Atlas.
- `GET /concept/:id`
  - Returns the focused concept with its summaries and neighbors as needed by the UI.
- `POST /concept`
  - Creates or updates a concept (explicit API; no LLM required).
- `POST /edge`
  - Creates an edge (manual graph editing).
- `POST /ingest`
  - Uploads a local document (text/markdown via `text`, PDFs via `base64`), stores raw bytes + metadata, chunks it, and indexes chunks for search.
- `GET /search?q=...`
  - v1: concept + chunk search.
  - Response shape: `{ results: ConceptSummary[], chunkResults: ChunkSearchHit[] }`.

## Planned Modules (Later)
- Sources:
  - capture/upload -> chunking -> indexing
- Changesets:
  - list/inspect/accept/reject/apply
- Tutor:
  - grounded Q/A returning citations + used subgraph ids (Structured Outputs on the LLM side)
- Review:
  - fetch due items, submit attempts, grade, update schedule
