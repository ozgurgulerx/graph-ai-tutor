import type {
  OpenAIResponsesClient,
  OpenAIResponsesCreateRequest,
  OpenAIResponsesResponse
} from "./responses";

export type JsonSchema = Record<string, unknown>;

export type StructuredOutputSpec = {
  name: string;
  schema: JsonSchema;
  strict?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOutputTextFromResponse(response: OpenAIResponsesResponse): string {
  const output = response.output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!isObject(item)) continue;
    if (item.type !== "message") continue;

    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (!isObject(c)) continue;
      if (c.type !== "output_text") continue;
      const text = c.text;
      if (typeof text === "string") parts.push(text);
    }
  }

  return parts.join("");
}

export function createJsonSchemaTextFormat(spec: StructuredOutputSpec): {
  type: "json_schema";
  name: string;
  schema: JsonSchema;
  strict: boolean;
} {
  return {
    type: "json_schema",
    name: spec.name,
    schema: spec.schema,
    strict: spec.strict ?? true
  };
}

export function parseJsonFromResponse<T>(response: OpenAIResponsesResponse): T {
  const text = getOutputTextFromResponse(response).trim();
  if (!text) throw new Error("OpenAI response had no output_text content to parse");
  return JSON.parse(text) as T;
}

export async function runStructuredOutput<T>(
  client: OpenAIResponsesClient,
  params: {
    model: string;
    input: unknown;
    spec: StructuredOutputSpec;
    maxRetries?: number;
    request?: Omit<OpenAIResponsesCreateRequest, "model" | "input" | "text">;
  }
): Promise<{ data: T; response: OpenAIResponsesResponse }> {
  const maxRetries = params.maxRetries ?? 2;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await client.create({
      ...(params.request ?? {}),
      model: params.model,
      input: params.input,
      text: { format: createJsonSchemaTextFormat(params.spec) }
    });

    try {
      return { data: parseJsonFromResponse<T>(response), response };
    } catch (err) {
      if (err instanceof SyntaxError && attempt < maxRetries) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

