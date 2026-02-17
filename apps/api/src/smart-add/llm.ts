import {
  createOpenAIResponsesClient,
  resolveModel,
  runStructuredOutput
} from "@graph-ai-tutor/llm";

import { SmartAddProposalJsonSchema } from "./schema";

export type SmartAddInput = {
  title: string;
  existingConcepts: {
    id: string;
    title: string;
    kind: string;
    module: string | null;
    l0: string | null;
  }[];
  existingEdges: { fromConceptId: string; toConceptId: string; type: string }[];
};

export type SmartAddLlm = {
  propose: (input: SmartAddInput) => Promise<unknown>;
};

export function createTestSmartAddLlm(): SmartAddLlm {
  return {
    async propose(input: SmartAddInput): Promise<unknown> {
      const firstConcept = input.existingConcepts[0];
      return {
        kind: "Concept",
        l0: `Overview of ${input.title}.`,
        l1: [`Key aspect of ${input.title}`],
        module: null,
        edges: firstConcept
          ? [
              {
                existingConceptId: firstConcept.id,
                type: "PREREQUISITE_OF",
                direction: "from",
                confidence: 0.8,
                evidence: `${input.title} builds on ${firstConcept.title}`
              }
            ]
          : []
      };
    }
  };
}

export function createOpenAiSmartAddLlm(
  options: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  } = {}
): SmartAddLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

  return {
    async propose(input: SmartAddInput): Promise<unknown> {
      const system = [
        "You are a knowledge graph placement assistant.",
        "Given a new concept title and the existing knowledge graph, your job is to:",
        "1. Determine the concept's kind, l0 (one-sentence summary), l1 (bullet points), and module.",
        "2. Propose edges connecting this new concept to existing graph nodes.",
        "",
        "Rules:",
        "- kind must be one of the allowed NodeKind values.",
        "- l0 should be a concise one-sentence summary of the concept.",
        "- l1 should be 2-5 key bullet points about the concept.",
        "- module should match an existing module in the graph if the concept fits, otherwise null.",
        "- Edge direction: 'to' means existing→new, 'from' means new→existing.",
        "- Only reference existingConceptId values that appear in the provided concept list.",
        "- Prefer a small number (3-7) of high-confidence edges over many low-confidence ones.",
        "- Include evidence explaining why each edge makes sense.",
        "- Return JSON matching the provided JSON Schema."
      ].join("\n");

      const conceptsSlice = input.existingConcepts.slice(0, 150);
      const edgesSlice = input.existingEdges.slice(0, 100);

      const user = [
        `New concept to place: "${input.title}"`,
        "",
        "Existing graph concepts:",
        JSON.stringify(conceptsSlice, null, 2),
        "",
        "Existing graph edges (sample):",
        JSON.stringify(edgesSlice, null, 2)
      ].join("\n");

      const { data } = await runStructuredOutput(client, {
        model,
        input: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
        spec: {
          name: "smart_add_proposal",
          schema: SmartAddProposalJsonSchema,
          strict: true
        }
      });

      return data;
    }
  };
}
