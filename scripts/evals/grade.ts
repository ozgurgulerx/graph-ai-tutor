import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createOpenAIResponsesClient, resolveModel, runStructuredOutput } from "@graph-ai-tutor/llm";

import { loadEvalFixtures, validateEvalFixture, type EvalFixture } from "../../apps/api/src/evals/harness";

type GradeResult = {
  overall: number; // 0..1
  criteria: {
    groundedness: number; // 0..1
    usefulness: number; // 0..1
    format: number; // 0..1
  };
  notes: string;
};

const GradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "number", minimum: 0, maximum: 1 },
    criteria: {
      type: "object",
      additionalProperties: false,
      properties: {
        groundedness: { type: "number", minimum: 0, maximum: 1 },
        usefulness: { type: "number", minimum: 0, maximum: 1 },
        format: { type: "number", minimum: 0, maximum: 1 }
      },
      required: ["groundedness", "usefulness", "format"]
    },
    notes: { type: "string" }
  },
  required: ["overall", "criteria", "notes"]
} as const;

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatFixtureForGrading(fixture: EvalFixture): string {
  switch (fixture.type) {
    case "extraction":
      return [
        "TASK: Evaluate an extraction output (concepts + edges) for a learning knowledge graph.",
        "SCORE each criterion from 0.0 to 1.0.",
        "Groundedness: proposed items are supported by the provided chunks; no invented claims.",
        "Usefulness: small number of high-signal concepts/edges; good titles and summaries.",
        "Format: output respects the invariants (schema-valid, ids reference valid chunks/ids).",
        "",
        "INPUT CHUNKS:",
        toJson(fixture.input.chunks),
        "",
        "MODEL OUTPUT:",
        toJson(fixture.output),
        "",
        "EXPECTED INVARIANTS:",
        toJson(fixture.expect)
      ].join("\n");

    case "tutor":
      return [
        "TASK: Evaluate a tutor answer that must be grounded in citations.",
        "SCORE each criterion from 0.0 to 1.0.",
        "Groundedness: answer is supported by cited chunks; no hallucinated details.",
        "Usefulness: concise, correct, answers the question directly.",
        "Format: includes cited_chunk_ids; cited ids exist in citations; used ids exist in graph when required.",
        "",
        "QUESTION:",
        fixture.input.question,
        "",
        "GRAPH (nodes, edges):",
        toJson(fixture.graph),
        "",
        "MODEL OUTPUT:",
        toJson(fixture.output),
        "",
        "EXPECTED INVARIANTS:",
        toJson(fixture.expect)
      ].join("\n");

    case "distill":
      return [
        "TASK: Evaluate a distillation output (L1 bullets + L2 steps) for a concept.",
        "SCORE each criterion from 0.0 to 1.0.",
        "Groundedness: uses only evidence + existing summaries; no invented facts.",
        "Usefulness: L1 is concise and high-signal; L2 is clear and mechanism-like.",
        "Format: valid JSON with non-empty strings; sizes within expected bounds.",
        "",
        "CONCEPT INPUT:",
        toJson(fixture.input.concept),
        "",
        "EVIDENCE CHUNKS:",
        toJson(fixture.input.evidenceChunks),
        "",
        "MODEL OUTPUT:",
        toJson(fixture.output),
        "",
        "EXPECTED INVARIANTS:",
        toJson(fixture.expect)
      ].join("\n");
  }
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const fixtures = loadEvalFixtures();
  for (const f of fixtures) validateEvalFixture(f);

  const client = createOpenAIResponsesClient();
  const model = resolveModel("nano");

  const results: Array<{
    id: string;
    type: EvalFixture["type"];
    model: string;
    gradedAt: string;
    grade: GradeResult;
  }> = [];

  for (const fixture of fixtures) {
    const prompt = [
      "You are a strict evaluator for a local-first learning knowledge graph app.",
      "Return STRICT JSON matching the provided schema (no extra keys, no prose outside JSON).",
      "When uncertain, score lower and explain briefly in notes.",
      "",
      formatFixtureForGrading(fixture)
    ].join("\n");

    const { data } = await runStructuredOutput<GradeResult>(client, {
      model,
      input: prompt,
      spec: {
        name: "eval_grade_v1",
        schema: GradeJsonSchema
      }
    });

    results.push({
      id: fixture.id,
      type: fixture.type,
      model,
      gradedAt: new Date().toISOString(),
      grade: data
    });
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../..");
  const outDir = path.join(repoRoot, "evals", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `grades.${isoStamp()}.json`);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        model,
        gradedAt: new Date().toISOString(),
        results
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // eslint-disable-next-line no-console
  console.log(`Wrote grades: ${path.relative(repoRoot, outPath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

