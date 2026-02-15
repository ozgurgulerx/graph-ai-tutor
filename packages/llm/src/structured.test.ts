import { describe, expect, it } from "vitest";

import { createMockResponsesClient } from "./mocks";
import { parseJsonFromResponse, runStructuredOutput } from "./structured";

const TEST_SPEC = {
  name: "test",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "number" } },
    required: ["value"]
  }
} as const;

function okResponse(text: string) {
  return {
    output: [{ type: "message", content: [{ type: "output_text", text }] }]
  };
}

describe("structured outputs helpers", () => {
  it("parseJsonFromResponse extracts JSON from output_text", () => {
    const res = {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "{\"ok\":true}" }]
        }
      ]
    };

    expect(parseJsonFromResponse<{ ok: boolean }>(res)).toEqual({ ok: true });
  });

  it("runStructuredOutput attaches text.format json_schema and parses output", async () => {
    let seenReq: unknown;
    const client = createMockResponsesClient(async (req) => {
      seenReq = req;
      return okResponse("{\"value\":123}");
    });

    const { data } = await runStructuredOutput<{ value: number }>(client, {
      model: "gpt-test",
      input: "return value",
      spec: TEST_SPEC
    });

    expect(data).toEqual({ value: 123 });

    const req = seenReq as Record<string, unknown>;
    expect(req.model).toBe("gpt-test");
    expect(req.input).toBe("return value");
    const text = req.text as Record<string, unknown>;
    const format = text.format as Record<string, unknown>;
    expect(format.type).toBe("json_schema");
    expect(format.name).toBe("test");
  });

  it("retries on JSON parse failure then succeeds on 2nd attempt", async () => {
    let calls = 0;
    const client = createMockResponsesClient(async () => {
      calls++;
      if (calls === 1) return okResponse("not valid json {{{");
      return okResponse("{\"value\":42}");
    });

    const { data } = await runStructuredOutput<{ value: number }>(client, {
      model: "gpt-test",
      input: "test",
      spec: TEST_SPEC
    });

    expect(data).toEqual({ value: 42 });
    expect(calls).toBe(2);
  });

  it("gives up after maxRetries exhausted", async () => {
    let calls = 0;
    const client = createMockResponsesClient(async () => {
      calls++;
      return okResponse("bad json");
    });

    await expect(
      runStructuredOutput(client, {
        model: "gpt-test",
        input: "test",
        spec: TEST_SPEC,
        maxRetries: 2
      })
    ).rejects.toThrow(SyntaxError);

    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it("does not retry on empty output (Error, not SyntaxError)", async () => {
    let calls = 0;
    const client = createMockResponsesClient(async () => {
      calls++;
      return { output: [] };
    });

    await expect(
      runStructuredOutput(client, {
        model: "gpt-test",
        input: "test",
        spec: TEST_SPEC
      })
    ).rejects.toThrow("no output_text");

    expect(calls).toBe(1);
  });

  it("maxRetries: 0 disables retries", async () => {
    let calls = 0;
    const client = createMockResponsesClient(async () => {
      calls++;
      return okResponse("bad json");
    });

    await expect(
      runStructuredOutput(client, {
        model: "gpt-test",
        input: "test",
        spec: TEST_SPEC,
        maxRetries: 0
      })
    ).rejects.toThrow(SyntaxError);

    expect(calls).toBe(1);
  });
});

