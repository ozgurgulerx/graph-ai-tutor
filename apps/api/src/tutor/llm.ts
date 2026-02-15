import { createOpenAIResponsesClient, resolveModel, runStructuredOutput } from "@graph-ai-tutor/llm";
import type { EvidenceChunk } from "@graph-ai-tutor/db";
import type { ConceptSummary, EdgeSummary } from "@graph-ai-tutor/shared";

import { TutorAnswerJsonSchema } from "./schema";

export type TutorLlmInput = {
  question: string;
  chunks: EvidenceChunk[];
  concepts: ConceptSummary[];
  edges: EdgeSummary[];
};

export type TutorLlm = {
  answer: (input: TutorLlmInput) => Promise<unknown>;
};

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createOpenAiTutorLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {}): TutorLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

  return {
    async answer(input) {
      const prompt = [
        "You are a grounded tutor for a learning knowledge graph.",
        "Answer the user's question using only the provided chunks + graph context.",
        "You MUST cite at least one chunk id in cited_chunk_ids.",
        "Return strict JSON that matches the schema; no extra keys; no prose outside JSON.",
        "",
        "Allowed chunk ids:",
        toJson(input.chunks.map((c) => c.id)),
        "",
        "Allowed concept ids:",
        toJson(input.concepts.map((c) => c.id)),
        "",
        "Allowed edge ids:",
        toJson(input.edges.map((e) => e.id)),
        "",
        "Chunks (id, sourceUrl, sourceTitle, content):",
        toJson(
          input.chunks.map((c) => ({
            id: c.id,
            sourceUrl: c.sourceUrl,
            sourceTitle: c.sourceTitle,
            content: c.content
          }))
        ),
        "",
        "Graph concepts (id, title, module):",
        toJson(input.concepts),
        "",
        "Graph edges (id, fromConceptId, toConceptId, type):",
        toJson(input.edges),
        "",
        `Question: ${input.question.trim()}`
      ].join("\n");

      const { data } = await runStructuredOutput<unknown>(client, {
        model,
        input: prompt,
        spec: {
          name: "tutor_answer",
          schema: TutorAnswerJsonSchema
        }
      });

      return data;
    }
  };
}

