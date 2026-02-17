import {
  createOpenAIResponsesClient,
  resolveModel,
  runStructuredOutput
} from "@graph-ai-tutor/llm";

import { DocIngestProposalJsonSchema } from "./schema";

export type DocIngestInput = {
  document: string;
  existingConcepts: {
    id: string;
    title: string;
    kind: string;
    module: string | null;
    l0: string | null;
    l1: string[];
  }[];
  existingEdges: { fromConceptId: string; toConceptId: string; type: string }[];
};

export type DocIngestLlm = {
  resolve: (input: DocIngestInput) => Promise<unknown>;
};

export function createTestDocIngestLlm(): DocIngestLlm {
  return {
    async resolve(input: DocIngestInput): Promise<unknown> {
      const firstConcept = input.existingConcepts[0];
      return {
        deltas: firstConcept
          ? [
              {
                conceptId: firstConcept.id,
                l0: null,
                newL1: ["New bullet from document"],
                evidence: input.document.slice(0, 200),
                confidence: 0.8
              }
            ]
          : [],
        newConcepts: [
          {
            title: "Test New Concept",
            l0: "A test concept from the document.",
            l1: ["Detail bullet one"],
            kind: "Concept",
            module: null,
            edges: firstConcept
              ? [
                  {
                    existingConceptId: firstConcept.id,
                    type: "PREREQUISITE_OF",
                    direction: "from",
                    confidence: 0.7,
                    evidence: "Derived from document"
                  }
                ]
              : []
          }
        ]
      };
    }
  };
}

export function createOpenAiDocIngestLlm(
  options: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  } = {}
): DocIngestLlm {
  const client = createOpenAIResponsesClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });

  const model = options.model ?? resolveModel("mini");

  return {
    async resolve(input: DocIngestInput): Promise<unknown> {
      const system = [
        "You analyze a document against an existing knowledge graph.",
        "Your job is to identify:",
        "1. Existing concepts the document relates to (deltas) — propose additive newL1 bullets and optionally a new l0 summary.",
        "2. Genuinely new concepts the document introduces that are NOT in the existing graph.",
        "",
        "Rules:",
        "- For deltas: only propose newL1 bullets that add information NOT already in the concept's l1. Do NOT repeat existing bullets.",
        "- For deltas: only propose l0 if the document genuinely changes the summary. Set l0 to null to keep the current summary.",
        "- For newConcepts: only propose concepts that are genuinely absent from the graph. Do NOT re-propose existing concepts.",
        "- Edge direction: 'to' means existing→new, 'from' means new→existing.",
        "- Prefer a small number of high-signal items over many low-signal items.",
        "- Concept IDs in deltas must match existing concept IDs exactly.",
        "- Return JSON matching the provided JSON Schema."
      ].join("\n");

      const conceptsSlice = input.existingConcepts.slice(0, 150);
      const edgesSlice = input.existingEdges.slice(0, 100);

      const user = [
        "Document to analyze:",
        input.document,
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
          name: "doc_ingest_proposal",
          schema: DocIngestProposalJsonSchema,
          strict: true
        }
      });

      return data;
    }
  };
}
