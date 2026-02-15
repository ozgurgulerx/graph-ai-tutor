import { describe, expect, it } from "vitest";

import { createOpenAIResponsesClient } from "./responses";

describe("createOpenAIResponsesClient", () => {
  it("POSTs to /v1/responses with auth header", async () => {
    let seenUrl: string | undefined;
    let seenInit:
      | {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        }
      | undefined;

    const client = createOpenAIResponsesClient({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      fetch: async (input, init) => {
        seenUrl = input;
        seenInit = init;
        return {
          ok: true,
          status: 200,
          async json() {
            return { id: "resp_123", output: [] };
          },
          async text() {
            return "";
          }
        };
      }
    });

    const res = await client.create({ model: "gpt-test", input: "hi" });
    expect(res.id).toBe("resp_123");
    expect(seenUrl).toBe("https://example.test/v1/responses");
    expect(seenInit?.method).toBe("POST");
    expect(seenInit?.headers?.Authorization).toBe("Bearer test-key");
    expect(seenInit?.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(seenInit?.body ?? "{}") as Record<string, unknown>;
    expect(body.model).toBe("gpt-test");
    expect(body.input).toBe("hi");
  });

  it("throws a useful error on non-2xx", async () => {
    const client = createOpenAIResponsesClient({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      fetch: async () => {
        return {
          ok: false,
          status: 401,
          async json() {
            return { error: { message: "nope" } };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(
      client.create({ model: "gpt-test", input: "hi" })
    ).rejects.toThrow(/status 401.*nope/);
  });
});

