import type { Repositories } from "@graph-ai-tutor/db";
import type { PostDocIngestResolveResponse } from "@graph-ai-tutor/shared";

import type { DocIngestLlm } from "./llm";
import { DocIngestProposalSchema } from "./schema";

export async function runDocIngestResolve(input: {
  repos: Repositories;
  llm: DocIngestLlm;
  document: string;
}): Promise<PostDocIngestResolveResponse> {
  const concepts = await input.repos.concept.listWithNotes();
  const edges = await input.repos.edge.listSummaries();

  const raw = await input.llm.resolve({
    document: input.document,
    existingConcepts: concepts.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      module: c.module,
      l0: c.l0,
      l1: c.l1
    })),
    existingEdges: edges.map((e) => ({
      fromConceptId: e.fromConceptId,
      toConceptId: e.toConceptId,
      type: e.type
    }))
  });

  const proposal = DocIngestProposalSchema.parse(raw);

  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  // Validate and enrich deltas — skip any referencing non-existent concepts
  const deltas = proposal.deltas
    .filter((d) => conceptMap.has(d.conceptId))
    .map((d) => {
      const existing = conceptMap.get(d.conceptId)!;
      return {
        conceptId: d.conceptId,
        conceptTitle: existing.title,
        currentL0: existing.l0,
        proposedL0: d.l0,
        currentL1: existing.l1,
        newL1: d.newL1,
        evidence: d.evidence,
        confidence: d.confidence
      };
    });

  // Validate new concept edges — only keep edges referencing existing concepts
  const existingIds = new Set(concepts.map((c) => c.id));
  const newConcepts = proposal.newConcepts.map((nc) => ({
    title: nc.title,
    l0: nc.l0,
    l1: nc.l1,
    kind: nc.kind,
    module: nc.module,
    edges: nc.edges.filter((e) => existingIds.has(e.existingConceptId))
  }));

  return { deltas, newConcepts };
}
