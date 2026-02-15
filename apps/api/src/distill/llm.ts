import { createOpenAIResponsesClient, resolveModel, runStructuredOutput } from "@graph-ai-tutor/llm";
import type { EvidenceChunk } from "@graph-ai-tutor/db";

import { DistillOutputJsonSchema } from "./schema";

export type DistillLlmInput = {
  concept: { id: string; title: string; l1: string[]; l2: string[] };
  evidenceChunks: EvidenceChunk[];
};

export type DistillLlm = {
  distill: (input: DistillLlmInput) => Promise<unknown>;
};

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createOpenAiDistillLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {}): DistillLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

  return {
    async distill(input) {
      const prompt = [
        "You are a careful technical editor for a local-first learning knowledge graph.",
        "Your job: propose improved L1 bullets and L2 mechanism steps for a single concept.",
        "Use ONLY the provided evidence chunks + existing summaries. Do not invent facts.",
        "Keep L1 concise (3-7 bullets ideal) and L2 as 5-12 ordered steps when possible.",
        "Return strict JSON matching the schema (no extra keys, no prose).",
        "",
        `concept_id: ${input.concept.id}`,
        `concept_title: ${input.concept.title}`,
        "",
        "current_l1:",
        toJson(input.concept.l1),
        "",
        "current_l2:",
        toJson(input.concept.l2),
        "",
        "evidence_chunks (id, sourceUrl, sourceTitle, content):",
        toJson(
          input.evidenceChunks.map((c) => ({
            id: c.id,
            sourceUrl: c.sourceUrl,
            sourceTitle: c.sourceTitle,
            content: c.content
          }))
        )
      ].join("\n");

      const { data } = await runStructuredOutput<unknown>(client, {
        model,
        input: prompt,
        spec: {
          name: "distill_summaries",
          schema: DistillOutputJsonSchema
        }
      });

      return data;
    }
  };
}

export function createTestDistillLlm(): DistillLlm {
  return {
    async distill(input) {
      const title = input.concept.title.toLowerCase();
      if (title.includes("kv cache")) {
        return {
          l1: [
            "Avoids recomputing attention over the full prefix during decoding",
            "Caches per-layer keys and values from previous tokens",
            "Grows with sequence length and consumes memory bandwidth"
          ],
          l2: [
            "During decoding, compute Q for the new token.",
            "Reuse cached K/V for prior tokens instead of recomputing them.",
            "Compute attention for the new token over cached K/V.",
            "Append the new token's K/V to the cache for the next step."
          ]
        };
      }

      return {
        l1: input.concept.l1.length > 0 ? input.concept.l1 : ["(No L1 yet)"],
        l2: input.concept.l2.length > 0 ? input.concept.l2 : ["(No L2 yet)"]
      };
    }
  };
}

