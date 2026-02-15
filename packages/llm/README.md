# @graph-ai-tutor/llm

Thin, testable wrapper around the OpenAI Responses API used by this monorepo.

## Environment variables

- `OPENAI_API_KEY` (required to make live calls)
- `OPENAI_BASE_URL` (optional, default: `https://api.openai.com/v1`)
- `OPENAI_MODEL_NANO` (optional, default: `gpt-5-nano`)
- `OPENAI_MODEL_MINI` (optional, default: `gpt-5-mini`)
- `OPENAI_RUN_INTEGRATION_TESTS=1` (optional, runs the live integration test)
