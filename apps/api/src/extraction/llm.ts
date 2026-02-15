import { ExtractionCandidatesJsonSchema } from "./schema";

export type ExtractionChunkInput = {
  id: string;
  content: string;
  startOffset: number;
  endOffset: number;
};

export type ProposeCandidatesInput = {
  sourceId: string;
  chunks: ExtractionChunkInput[];
};

export type ExtractionLlm = {
  proposeCandidates: (input: ProposeCandidatesInput) => Promise<unknown>;
};

type OpenAiResponsesResponse = {
  output?: unknown;
  [key: string]: unknown;
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

function getOutputTextFromResponse(response: OpenAiResponsesResponse): string {
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

function toJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

export function createOpenAiExtractionLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {}): ExtractionLlm {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use the OpenAI extraction LLM");
  }

  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const model = options.model ?? "gpt-5-mini";

  return {
    async proposeCandidates(input: ProposeCandidatesInput): Promise<unknown> {
      const system = [
        "You extract candidate Concepts and Edges from source chunks for a learning knowledge graph.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "Every Concept and every Edge MUST include evidenceChunkIds referencing one or more provided chunk ids.",
        "Use only chunk ids from the provided input.",
        "Edges must not be self-loops (fromConceptId != toConceptId).",
        "Edges must reference concept ids that appear in the output concepts list.",
        "Prefer a small number of high-signal items over many low-signal items."
      ].join("\n");

      const user = [
        `source_id: ${input.sourceId}`,
        "chunks (id, offsets, content):",
        toJson(input.chunks)
      ].join("\n\n");

      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
          text: {
            format: {
              type: "json_schema",
              name: "extraction_candidates",
              strict: true,
              schema: ExtractionCandidatesJsonSchema
            }
          }
        })
      });

      if (!res.ok) {
        const payload = (await res.json().catch(async () => {
          const text = await res.text().catch(() => "");
          throw new Error(
            `OpenAI /responses returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
          );
        })) as unknown;
        const msg = getErrorMessage(payload) ?? `Request failed (${res.status} ${res.statusText})`;
        throw new Error(`OpenAI /responses error: ${msg}`);
      }

      const payload = (await res.json()) as unknown;
      if (!isObject(payload)) {
        throw new Error("OpenAI /responses returned unexpected payload");
      }

      const content = getOutputTextFromResponse(payload as OpenAiResponsesResponse).trim();
      if (!content) {
        throw new Error("OpenAI /responses had no output_text content to parse");
      }

      try {
        return JSON.parse(content) as unknown;
      } catch (err) {
        throw new Error(`OpenAI /responses output_text was not valid JSON: ${String(err)}`);
      }
    }
  };
}
