import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { GraphResponseSchema, PostTutorResponseSchema } from "@graph-ai-tutor/shared";

import { ExtractionCandidatesSchema } from "../extraction/schema";
import { DistillOutputSchema } from "../distill/schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ChunkInputSchema = z
  .object({
    id: z.string().min(1),
    content: z.string().min(1),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0)
  })
  .strict();

const ExtractionEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("extraction"),
    input: z
      .object({
        sourceId: z.string().min(1),
        chunks: z.array(ChunkInputSchema).min(1)
      })
      .strict(),
    output: z.unknown(),
    expect: z
      .object({
        minConcepts: z.number().int().min(0),
        minEdges: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

const TutorEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("tutor"),
    graph: z.unknown(),
    input: z
      .object({
        question: z.string().min(1)
      })
      .strict(),
    output: z.unknown(),
    expect: z
      .object({
        minCitations: z.number().int().min(0),
        requireUsedSubgraph: z.boolean()
      })
      .strict()
  })
  .strict();

const DistillEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("distill"),
    input: z
      .object({
        concept: z
          .object({
            id: z.string().min(1),
            title: z.string().min(1),
            l1: z.array(z.string()),
            l2: z.array(z.string())
          })
          .strict(),
        evidenceChunks: z.array(z.unknown())
      })
      .strict(),
    output: z.unknown(),
    expect: z
      .object({
        minL1: z.number().int().min(0),
        minL2: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

export const EvalFixtureSchema = z.discriminatedUnion("type", [
  ExtractionEvalFixtureSchema,
  TutorEvalFixtureSchema,
  DistillEvalFixtureSchema
]);

export type EvalFixture = z.infer<typeof EvalFixtureSchema>;

export function evalsFixturesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../../..");
  return path.join(repoRoot, "fixtures", "evals");
}

export function loadEvalFixtures(dir: string = evalsFixturesDir()): EvalFixture[] {
  const entries = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  return entries.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return EvalFixtureSchema.parse(parsed);
  });
}

export function validateEvalFixture(fixture: EvalFixture): void {
  switch (fixture.type) {
    case "extraction": {
      const output = ExtractionCandidatesSchema.parse(fixture.output);
      assert(output.concepts.length >= fixture.expect.minConcepts, "Expected more concepts");
      assert(output.edges.length >= fixture.expect.minEdges, "Expected more edges");

      const chunkIds = new Set(fixture.input.chunks.map((c) => c.id));
      const conceptIds = output.concepts.map((c) => c.id);
      assert(new Set(conceptIds).size === conceptIds.length, "Duplicate concept ids in output");

      const conceptIdSet = new Set(conceptIds);

      for (const concept of output.concepts) {
        for (const chunkId of concept.evidenceChunkIds) {
          assert(chunkIds.has(chunkId), `Concept ${concept.id} references unknown chunk id: ${chunkId}`);
        }
      }

      for (const edge of output.edges) {
        assert(conceptIdSet.has(edge.fromConceptId), `Edge fromConceptId not in concepts: ${edge.fromConceptId}`);
        assert(conceptIdSet.has(edge.toConceptId), `Edge toConceptId not in concepts: ${edge.toConceptId}`);
        for (const chunkId of edge.evidenceChunkIds) {
          assert(chunkIds.has(chunkId), `Edge references unknown chunk id: ${chunkId}`);
        }
      }

      break;
    }

    case "tutor": {
      const graph = GraphResponseSchema.parse(fixture.graph);
      const output = PostTutorResponseSchema.parse(fixture.output);

      assert(output.result.cited_chunk_ids.length >= fixture.expect.minCitations, "Expected more citations");

      const citationIds = new Set(output.citations.map((c) => c.id));
      for (const id of output.result.cited_chunk_ids) {
        assert(citationIds.has(id), `cited_chunk_ids contains id missing from citations: ${id}`);
      }

      if (fixture.expect.requireUsedSubgraph) {
        const nodeIds = new Set(graph.nodes.map((n) => n.id));
        const edgeIds = new Set(graph.edges.map((e) => e.id));

        for (const id of output.result.used_concept_ids) {
          assert(nodeIds.has(id), `used_concept_ids references unknown node id: ${id}`);
        }
        for (const id of output.result.used_edge_ids) {
          assert(edgeIds.has(id), `used_edge_ids references unknown edge id: ${id}`);
        }
      }

      break;
    }

    case "distill": {
      const output = DistillOutputSchema.parse(fixture.output);
      assert(output.l1.length >= fixture.expect.minL1, "Expected more L1 bullets");
      assert(output.l2.length >= fixture.expect.minL2, "Expected more L2 steps");
      break;
    }
  }
}

