import { describe, expect, it } from "vitest";

import { createOpenAIResponsesClient } from "./responses";
import { runStructuredOutput } from "./structured";

const apiKey = process.env.OPENAI_API_KEY;
const shouldRun = Boolean(apiKey) && process.env.OPENAI_RUN_INTEGRATION_TESTS === "1";
const describeIf = shouldRun ? describe : describe.skip;

describeIf("OpenAI Responses API (integration)", () => {
  it(
    "returns structured JSON that matches the schema",
    async () => {
      const client = createOpenAIResponsesClient({ apiKey });
      const { data } = await runStructuredOutput<{ ok: boolean }>(client, {
        model: process.env.OPENAI_MODEL_NANO ?? "gpt-5-nano",
        input: 'Return a JSON object like {"ok": true}.',
        spec: {
          name: "ok_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { ok: { type: "boolean" } },
            required: ["ok"]
          }
        }
      });

      expect(data.ok).toBe(true);
    },
    { timeout: 60_000 }
  );
});
