import type { DraftRevision, EvidenceChunk, Repositories, SummaryLevels } from "@graph-ai-tutor/db";

import type { DistillLlm } from "./llm";
import { DistillOutputSchema } from "./schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean);
}

function buildFullReplaceDiff(label: string, before: string[], after: string[]): string {
  const a = normalizeLines(before);
  const b = normalizeLines(after);
  const lines: string[] = [`--- ${label} (before)`, `+++ ${label} (after)`];
  for (const line of a) lines.push(`- ${line}`);
  for (const line of b) lines.push(`+ ${line}`);
  return `${lines.join("\n")}\n`;
}

function buildSummaryDiff(before: SummaryLevels, after: SummaryLevels): string {
  return [buildFullReplaceDiff("L1", before.l1, after.l1), buildFullReplaceDiff("L2", before.l2, after.l2)].join(
    "\n"
  );
}

export async function runDistillJob(input: {
  repos: Repositories;
  llm: DistillLlm;
  conceptId: string;
  evidenceLimit?: number;
}): Promise<DraftRevision> {
  const concept = await input.repos.concept.getById(input.conceptId);
  assert(concept, `Concept not found: ${input.conceptId}`);

  const evidenceChunkIds = await input.repos.edge.listEvidenceChunkIdsForConcept(
    input.conceptId,
    input.evidenceLimit ?? 12
  );
  const evidenceChunks: EvidenceChunk[] = await input.repos.chunk.listEvidenceByIds(
    evidenceChunkIds
  );

  const raw = await input.llm.distill({
    concept: {
      id: concept.id,
      title: concept.title,
      l1: concept.l1,
      l2: concept.l2
    },
    evidenceChunks
  });

  const proposed = DistillOutputSchema.parse(raw);

  const before: SummaryLevels = {
    l1: concept.l1,
    l2: concept.l2
  };

  const after: SummaryLevels = {
    l1: normalizeLines(proposed.l1),
    l2: normalizeLines(proposed.l2)
  };

  const diff = buildSummaryDiff(before, after);

  return await input.repos.draftRevision.create({
    conceptId: concept.id,
    kind: "distill",
    before,
    after,
    diff
  });
}

