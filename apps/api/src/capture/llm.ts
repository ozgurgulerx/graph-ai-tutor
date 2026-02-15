import {
  createOpenAIResponsesClient,
  resolveModel,
  runStructuredOutput
} from "@graph-ai-tutor/llm";

import { CaptureProposalJsonSchema } from "./schema";

export type CaptureInput = {
  text: string;
  existingConcepts: { id: string; title: string }[];
  existingEdges: { fromConceptId: string; toConceptId: string; type: string }[];
};

export type CaptureLlm = {
  propose: (input: CaptureInput) => Promise<unknown>;
};

export function createTestCaptureLlm(): CaptureLlm {
  return {
    async propose(input: CaptureInput): Promise<unknown> {
      // Keep fixtures deterministic and avoid touching the existing concept table.
      // The capture job will wrap this proposal in a changeset for review.
      return {
        concepts: [
          {
            id: "concept_gradient_checkpointing",
            title: "Gradient checkpointing",
            l0: "Trade compute for memory by recomputing activations during the backward pass.",
            l1: [
              "Recompute some activations during backward instead of storing them",
              "Reduces activation memory at the cost of extra compute"
            ],
            module: null,
            evidence: input.text.slice(0, 200),
            confidence: 0.72
          }
        ],
        edges: []
      };
    }
  };
}

export function createOpenAiCaptureLlm(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {}): CaptureLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

  return {
    async propose(input: CaptureInput): Promise<unknown> {
      const system = [
        "You extract candidate Concepts and Edges from user-provided learning notes for a knowledge graph.",
        "Return JSON that strictly matches the provided JSON Schema (no extra keys).",
        "Each concept must have a short `evidence` string explaining the user's note that supports it.",
        "Each edge must have an `evidence` string quoting or paraphrasing the user's note.",
        "Edges must not be self-loops (fromConceptId != toConceptId).",
        "Edge endpoints must reference either proposed concept IDs or IDs from the existing graph.",
        "Prefer a small number of high-signal items over many low-signal items.",
        "Concept IDs must be kebab-case slugs prefixed with 'concept_'."
      ].join("\n");

      const user = [
        "User learning note:",
        input.text,
        "",
        "Existing graph concepts:",
        JSON.stringify(input.existingConcepts.slice(0, 200), null, 2),
        "",
        "Existing graph edges (sample):",
        JSON.stringify(input.existingEdges.slice(0, 100), null, 2)
      ].join("\n");

      const { data } = await runStructuredOutput(client, {
        model,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "capture_proposal",
          schema: CaptureProposalJsonSchema,
          strict: true
        }
      });

      return data;
    }
  };
}
