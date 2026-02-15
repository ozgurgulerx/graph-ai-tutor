import { describe, expect, it, vi } from "vitest";

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: class {},
  getBearerTokenProvider: () => async () => "mock-entra-token"
}));

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

  it("uses Azure Entra ID bearer token when AZURE_OPENAI_ENDPOINT is set", async () => {
    let seenUrl: string | undefined;
    let seenInit:
      | {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        }
      | undefined;

    const client = createOpenAIResponsesClient({
      env: {
        AZURE_OPENAI_ENDPOINT: "https://myresource.openai.azure.com",
        AZURE_OPENAI_API_VERSION: "2024-12-01-preview"
      } as NodeJS.ProcessEnv,
      fetch: async (input, init) => {
        seenUrl = input;
        seenInit = init;
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              choices: [
                { message: { content: '{"answer":"hello"}' } }
              ]
            };
          },
          async text() {
            return "";
          }
        };
      }
    });

    const res = await client.create({ model: "gpt-4o", input: "hi" });

    expect(seenUrl).toBe(
      "https://myresource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-12-01-preview"
    );
    expect(seenInit?.method).toBe("POST");
    expect(seenInit?.headers?.Authorization).toBe("Bearer mock-entra-token");
    expect(seenInit?.headers?.["api-key"]).toBeUndefined();
    expect(seenInit?.headers?.["Content-Type"]).toBe("application/json");

    // Verify response is wrapped in Responses API shape
    const output = res.output as Array<{ type: string; content: Array<{ type: string; text: string }> }>;
    expect(output[0].type).toBe("message");
    expect(output[0].content[0].text).toBe('{"answer":"hello"}');
  });

  it("uses api-key header when AZURE_OPENAI_API_KEY is set", async () => {
    let seenInit:
      | {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        }
      | undefined;

    const client = createOpenAIResponsesClient({
      env: {
        AZURE_OPENAI_ENDPOINT: "https://myresource.openai.azure.com",
        AZURE_OPENAI_API_KEY: "my-azure-key"
      } as NodeJS.ProcessEnv,
      fetch: async (_input, init) => {
        seenInit = init;
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              choices: [
                { message: { content: '{"answer":"hello"}' } }
              ]
            };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await client.create({ model: "gpt-4o", input: "hi" });

    expect(seenInit?.headers?.["api-key"]).toBe("my-azure-key");
    expect(seenInit?.headers?.Authorization).toBeUndefined();
    expect(seenInit?.headers?.["Content-Type"]).toBe("application/json");
  });

  it("throws when no credentials are provided", () => {
    expect(() =>
      createOpenAIResponsesClient({
        env: {} as NodeJS.ProcessEnv,
        fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" })
      })
    ).toThrow(/No LLM credentials found/);
  });
});
