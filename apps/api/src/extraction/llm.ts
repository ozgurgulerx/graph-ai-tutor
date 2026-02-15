import { createOpenAIResponsesClient, resolveModel, runStructuredOutput } from "@graph-ai-tutor/llm";
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

function toJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

export function createOpenAiExtractionLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {}): ExtractionLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

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

      const { data } = await runStructuredOutput<unknown>(client, {
        model,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "extraction_candidates",
          schema: ExtractionCandidatesJsonSchema,
          strict: true
        }
      });

      return data;
    }
  };
}
