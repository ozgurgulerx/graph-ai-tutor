import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export type OpenAIRequestOptions = {
  signal?: AbortSignal;
};

export type OpenAIResponsesCreateRequest = {
  model: string;
  input: unknown;
  text?: unknown;
  [key: string]: unknown;
};

export type OpenAIResponsesResponse = {
  output?: unknown;
  [key: string]: unknown;
};

export type OpenAIResponsesClient = {
  create: (
    req: OpenAIResponsesCreateRequest,
    options?: OpenAIRequestOptions
  ) => Promise<OpenAIResponsesResponse>;
};

export type CreateOpenAIResponsesClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetch?: FetchLike;
  env?: NodeJS.ProcessEnv;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: unknown): string | undefined {
  if (!isObject(payload)) return undefined;
  const err = payload.error;
  if (!isObject(err)) return undefined;
  const msg = err.message;
  return typeof msg === "string" ? msg : undefined;
}

// ---------------------------------------------------------------------------
// Azure Chat Completions → OpenAIResponsesClient adapter
// ---------------------------------------------------------------------------

type AzureConfig = {
  endpoint: string;
  apiVersion: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
};

/**
 * Translate a Responses-API request into an Azure Chat Completions request.
 *
 * input (string)  → messages: [{ role: "user", content: input }]
 * text.format     → response_format with json_schema wrapper
 */
function toAzureChatBody(req: OpenAIResponsesCreateRequest): Record<string, unknown> {
  // Build messages from input
  const input = req.input;
  let messages: Array<{ role: string; content: string }>;
  if (typeof input === "string") {
    messages = [{ role: "user", content: input }];
  } else if (Array.isArray(input)) {
    messages = input as Array<{ role: string; content: string }>;
  } else {
    messages = [{ role: "user", content: String(input) }];
  }

  const body: Record<string, unknown> = { messages };

  // Translate text.format (json_schema) → response_format
  const text = req.text;
  if (isObject(text)) {
    const format = text.format;
    if (isObject(format) && format.type === "json_schema") {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: format.name,
          schema: format.schema,
          strict: format.strict ?? true
        }
      };
    }
  }

  return body;
}

/**
 * Wrap an Azure Chat Completions response into the Responses-API shape
 * expected by structured.ts / parseJsonFromResponse.
 */
function fromAzureChatResponse(payload: Record<string, unknown>): OpenAIResponsesResponse {
  let text = "";
  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = first?.message;
    if (isObject(message) && typeof message.content === "string") {
      text = message.content;
    }
  }

  return {
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text }]
      }
    ]
  };
}

function createAzureChatCompletionsClient(
  azure: AzureConfig,
  fetchFn: FetchLike
): OpenAIResponsesClient {
  const endpoint = azure.endpoint.replace(/\/+$/, "");

  return {
    async create(req, options) {
      const deployment = req.model;
      const url =
        `${endpoint}/openai/deployments/${deployment}/chat/completions` +
        `?api-version=${azure.apiVersion}`;

      const authHeaders = await azure.getAuthHeaders();
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toAzureChatBody(req)),
        signal: options?.signal
      });

      const payload = await res.json().catch(async () => {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Azure Chat Completions returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
        );
      });

      if (!res.ok) {
        const msg = getErrorMessage(payload) ?? "Request failed";
        throw new Error(`Azure Chat Completions error (status ${res.status}): ${msg}`);
      }

      if (!isObject(payload)) {
        throw new Error("Azure Chat Completions returned unexpected payload");
      }

      return fromAzureChatResponse(payload);
    }
  };
}

// ---------------------------------------------------------------------------
// Public factory — auto-detects OpenAI vs Azure
// ---------------------------------------------------------------------------

const DEFAULT_AZURE_API_VERSION = "2024-12-01-preview";

export function createOpenAIResponsesClient(
  opts: CreateOpenAIResponsesClientOptions = {}
): OpenAIResponsesClient {
  const env = opts.env ?? process.env;
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchFn) {
    throw new Error("global fetch is not available; pass { fetch }");
  }

  // Prefer explicit OPENAI_API_KEY; fall back to Azure credentials
  const openaiKey = opts.apiKey ?? env.OPENAI_API_KEY;

  if (openaiKey) {
    // Standard OpenAI Responses API (existing path)
    const baseUrl = (opts.baseUrl ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/+$/,
      ""
    );

    return {
      async create(req, options) {
        const res = await fetchFn(`${baseUrl}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(req),
          signal: options?.signal
        });

        const payload = await res.json().catch(async () => {
          const text = await res.text().catch(() => "");
          throw new Error(
            `OpenAI /responses returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
          );
        });

        if (!res.ok) {
          const msg = getErrorMessage(payload) ?? "Request failed";
          throw new Error(`OpenAI /responses error (status ${res.status}): ${msg}`);
        }

        if (!isObject(payload)) {
          throw new Error("OpenAI /responses returned unexpected payload");
        }

        return payload as OpenAIResponsesResponse;
      }
    };
  }

  // Azure OpenAI fallback — API key or Entra ID (DefaultAzureCredential)
  const azureEndpoint = env.AZURE_OPENAI_ENDPOINT;

  if (azureEndpoint) {
    const azureApiKey = env.AZURE_OPENAI_API_KEY;

    let getAuthHeaders: () => Promise<Record<string, string>>;
    if (azureApiKey) {
      getAuthHeaders = async () => ({ "api-key": azureApiKey });
    } else {
      const credential = new DefaultAzureCredential();
      const getToken = getBearerTokenProvider(
        credential,
        "https://cognitiveservices.azure.com/.default"
      );
      getAuthHeaders = async () => ({ Authorization: `Bearer ${await getToken()}` });
    }

    return createAzureChatCompletionsClient(
      {
        endpoint: azureEndpoint,
        apiVersion: env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION,
        getAuthHeaders
      },
      fetchFn
    );
  }

  throw new Error(
    "No LLM credentials found. Set OPENAI_API_KEY for OpenAI, " +
    "or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY for Azure OpenAI."
  );
}
