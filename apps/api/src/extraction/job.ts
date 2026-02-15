import type { Chunk, Repositories } from "@graph-ai-tutor/db";

import type { ExtractionLlm } from "./llm";
import { ExtractionCandidatesSchema, type ExtractionCandidates } from "./schema";

export type ExtractionJobResult = {
  changesetId: string;
  itemsCreated: number;
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function validateExtractionCandidates(input: {
  repos: Repositories;
  sourceId: string;
  chunks: Chunk[];
  candidates: ExtractionCandidates;
}): Promise<void> {
  const chunkIds = new Set(input.chunks.map((c) => c.id));
  const existingConceptIds = new Set(
    (await input.repos.concept.listSummaries()).map((c) => c.id)
  );

  const proposedConceptIds = new Set<string>();

  for (const concept of input.candidates.concepts) {
    assert(!proposedConceptIds.has(concept.id), `Duplicate concept id: ${concept.id}`);
    assert(
      !existingConceptIds.has(concept.id),
      `Proposed concept id already exists: ${concept.id}`
    );
    proposedConceptIds.add(concept.id);

    for (const chunkId of uniq(concept.evidenceChunkIds)) {
      assert(
        chunkIds.has(chunkId),
        `Concept ${concept.id} references missing evidence chunk id: ${chunkId}`
      );
    }
  }

  for (const edge of input.candidates.edges) {
    assert(
      edge.fromConceptId !== edge.toConceptId,
      `Self-loop edge: ${edge.fromConceptId} -> ${edge.toConceptId}`
    );

    const fromExists =
      existingConceptIds.has(edge.fromConceptId) || proposedConceptIds.has(edge.fromConceptId);
    assert(fromExists, `Edge fromConceptId not found: ${edge.fromConceptId}`);

    const toExists =
      existingConceptIds.has(edge.toConceptId) || proposedConceptIds.has(edge.toConceptId);
    assert(toExists, `Edge toConceptId not found: ${edge.toConceptId}`);

    for (const chunkId of uniq(edge.evidenceChunkIds)) {
      assert(
        chunkIds.has(chunkId),
        `Edge ${edge.fromConceptId} -> ${edge.toConceptId} references missing evidence chunk id: ${chunkId}`
      );
    }
  }
}

export async function runExtractionJob(input: {
  repos: Repositories;
  sourceId: string;
  llm: ExtractionLlm;
  chunks?: Chunk[];
}): Promise<ExtractionJobResult> {
  const source = await input.repos.source.getById(input.sourceId);
  assert(source, `Source not found: ${input.sourceId}`);

  const chunks = input.chunks ?? (await input.repos.chunk.listBySourceId(input.sourceId));
  assert(chunks.length > 0, `No chunks found for source: ${input.sourceId}`);

  const raw = await input.llm.proposeCandidates({
    sourceId: input.sourceId,
    chunks: chunks.map((c) => ({
      id: c.id,
      content: c.content,
      startOffset: c.startOffset,
      endOffset: c.endOffset
    }))
  });

  const candidates = ExtractionCandidatesSchema.parse(raw);

  await validateExtractionCandidates({
    repos: input.repos,
    sourceId: input.sourceId,
    chunks,
    candidates
  });

  const changeset = await input.repos.changeset.create({ sourceId: input.sourceId, status: "draft" });

  // Use deterministic item ids so list ordering is stable even when created_at ties (ms resolution).
  // This keeps tests and the Inbox UI deterministic.
  for (const [idx, concept] of candidates.concepts.entries()) {
    await input.repos.changesetItem.create({
      id: `changeset_item_${changeset.id}_c_${String(idx).padStart(4, "0")}`,
      changesetId: changeset.id,
      entityType: "concept",
      action: "create",
      payload: concept
    });
  }

  const edgeOffset = candidates.concepts.length;
  for (const [idx, edge] of candidates.edges.entries()) {
    await input.repos.changesetItem.create({
      id: `changeset_item_${changeset.id}_e_${String(edgeOffset + idx).padStart(4, "0")}`,
      changesetId: changeset.id,
      entityType: "edge",
      action: "create",
      payload: edge
    });
  }

  return {
    changesetId: changeset.id,
    itemsCreated: candidates.concepts.length + candidates.edges.length
  };
}
