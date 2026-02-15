export const TutorAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer_markdown: { type: "string", minLength: 1 },
    cited_chunk_ids: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 }
    },
    used_concept_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    used_edge_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["answer_markdown", "cited_chunk_ids", "used_concept_ids", "used_edge_ids"]
} as const;

