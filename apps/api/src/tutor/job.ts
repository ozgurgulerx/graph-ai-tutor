import type { EvidenceChunk, Repositories } from "@graph-ai-tutor/db";
import { TutorAnswerSchema, type PostTutorResponse, type TutorAnswer } from "@graph-ai-tutor/shared";

import type { TutorLlm } from "./llm";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractKeywords(question: string): string[] {
  const cleaned = question
    .replace(/[^a-zA-Z0-9_\s-]+/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  return uniq(cleaned).slice(0, 8);
}

async function findMatchedConceptIds(
  repos: Repositories,
  question: string,
  limit: number
): Promise<string[]> {
  const tokens = extractKeywords(question);
  const matched: string[] = [];
  for (const token of tokens) {
    const res = await repos.concept.searchSummaries(token, limit);
    for (const c of res) {
      if (matched.includes(c.id)) continue;
      matched.push(c.id);
      if (matched.length >= limit) return matched;
    }
  }
  return matched;
}

function validateTutorAnswer(input: {
  answer: TutorAnswer;
  allowedChunkIds: ReadonlySet<string>;
  allowedConceptIds: ReadonlySet<string>;
  allowedEdgeIds: ReadonlySet<string>;
}) {
  const cited = input.answer.cited_chunk_ids;
  assert(cited.length > 0, "Tutor must cite at least one chunk id");
  assert(cited.length === uniq(cited).length, "Duplicate cited_chunk_ids are not allowed");
  for (const id of cited) {
    assert(input.allowedChunkIds.has(id), `cited_chunk_ids references unknown chunk id: ${id}`);
  }

  const usedConcepts = input.answer.used_concept_ids;
  assert(
    usedConcepts.length === uniq(usedConcepts).length,
    "Duplicate used_concept_ids are not allowed"
  );
  for (const id of usedConcepts) {
    assert(input.allowedConceptIds.has(id), `used_concept_ids references unknown concept id: ${id}`);
  }

  const usedEdges = input.answer.used_edge_ids;
  assert(
    usedEdges.length === uniq(usedEdges).length,
    "Duplicate used_edge_ids are not allowed"
  );
  for (const id of usedEdges) {
    assert(input.allowedEdgeIds.has(id), `used_edge_ids references unknown edge id: ${id}`);
  }
}

function orderEvidenceById(items: EvidenceChunk[], ids: string[]): EvidenceChunk[] {
  const map = new Map(items.map((c) => [c.id, c]));
  const ordered: EvidenceChunk[] = [];
  for (const id of ids) {
    const item = map.get(id);
    if (item) ordered.push(item);
  }
  return ordered;
}

export async function runTutorJob(input: {
  repos: Repositories;
  llm: TutorLlm;
  question: string;
}): Promise<PostTutorResponse> {
  const question = input.question.trim();
  assert(question.length > 0, "Question is required");

  const matchedConceptIds = await findMatchedConceptIds(input.repos, question, 8);

  const neighborhoodEdges = await input.repos.edge.listSummariesByConceptIds(matchedConceptIds, 80);

  const neighborhoodConceptIdSet = new Set<string>(matchedConceptIds);
  for (const e of neighborhoodEdges) {
    neighborhoodConceptIdSet.add(e.fromConceptId);
    neighborhoodConceptIdSet.add(e.toConceptId);
  }
  const neighborhoodConcepts = await input.repos.concept.listSummariesByIds([
    ...neighborhoodConceptIdSet
  ]);

  let chunks = await input.repos.chunk.searchEvidence(question, 8);
  if (chunks.length === 0) {
    chunks = await input.repos.chunk.listRecentEvidence(8);
  }
  assert(chunks.length > 0, "No chunks available to ground the answer");

  const raw = await input.llm.answer({
    question,
    chunks,
    concepts: neighborhoodConcepts,
    edges: neighborhoodEdges
  });

  const answer = TutorAnswerSchema.parse(raw);

  validateTutorAnswer({
    answer,
    allowedChunkIds: new Set(chunks.map((c) => c.id)),
    allowedConceptIds: new Set(neighborhoodConcepts.map((c) => c.id)),
    allowedEdgeIds: new Set(neighborhoodEdges.map((e) => e.id))
  });

  const citationChunks = await input.repos.chunk.listEvidenceByIds(answer.cited_chunk_ids);

  return {
    result: answer,
    citations: orderEvidenceById(citationChunks, answer.cited_chunk_ids)
  };
}
