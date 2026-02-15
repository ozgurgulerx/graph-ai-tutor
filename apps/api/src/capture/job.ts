import type { Repositories } from "@graph-ai-tutor/db";

import type { CaptureLlm } from "./llm";
import { CaptureProposalSchema, type CaptureProposal } from "./schema";

export type CaptureJobResult = {
  changesetId: string;
  itemsCreated: number;
  sourceId: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function validateCaptureProposal(input: {
  repos: Repositories;
  proposal: CaptureProposal;
}): Promise<void> {
  const existingConceptIds = new Set(
    (await input.repos.concept.listSummaries()).map((c) => c.id)
  );

  const proposedConceptIds = new Set<string>();

  for (const concept of input.proposal.concepts) {
    assert(!proposedConceptIds.has(concept.id), `Duplicate concept id: ${concept.id}`);
    assert(
      !existingConceptIds.has(concept.id),
      `Proposed concept id already exists: ${concept.id}`
    );
    proposedConceptIds.add(concept.id);
  }

  for (const edge of input.proposal.edges) {
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
  }
}

export async function runCaptureJob(input: {
  repos: Repositories;
  llm: CaptureLlm;
  text: string;
}): Promise<CaptureJobResult> {
  const concepts = await input.repos.concept.listSummaries();
  const edges = await input.repos.edge.listSummaries();

  const raw = await input.llm.propose({
    text: input.text,
    existingConcepts: concepts.map((c) => ({ id: c.id, title: c.title })),
    existingEdges: edges.map((e) => ({
      fromConceptId: e.fromConceptId,
      toConceptId: e.toConceptId,
      type: e.type
    }))
  });

  const proposal = CaptureProposalSchema.parse(raw);

  await validateCaptureProposal({ repos: input.repos, proposal });

  const url = `capture://${Date.now()}`;
  const source = await input.repos.source.create({ url, title: null });

  const changeset = await input.repos.changeset.create({
    sourceId: source.id,
    status: "draft"
  });

  for (const concept of proposal.concepts) {
    await input.repos.changesetItem.create({
      changesetId: changeset.id,
      entityType: "concept",
      action: "create",
      payload: {
        id: concept.id,
        title: concept.title,
        l0: concept.l0,
        l1: concept.l1,
        module: concept.module,
        evidence: concept.evidence,
        confidence: concept.confidence,
        evidenceChunkIds: []
      }
    });
  }

  for (const edge of proposal.edges) {
    await input.repos.changesetItem.create({
      changesetId: changeset.id,
      entityType: "edge",
      action: "create",
      payload: {
        fromConceptId: edge.fromConceptId,
        toConceptId: edge.toConceptId,
        type: edge.type,
        evidence: edge.evidence,
        confidence: edge.confidence,
        evidenceChunkIds: []
      }
    });
  }

  return {
    changesetId: changeset.id,
    itemsCreated: proposal.concepts.length + proposal.edges.length,
    sourceId: source.id
  };
}
