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

export function createOpenAIResponsesClient(
  opts: CreateOpenAIResponsesClientOptions = {}
): OpenAIResponsesClient {
  const env = opts.env ?? process.env;
  const apiKey = opts.apiKey ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to call OpenAI");
  }

  const baseUrl = (opts.baseUrl ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchFn) {
    throw new Error("global fetch is not available; pass { fetch }");
  }

  return {
    async create(req, options) {
      const res = await fetchFn(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

