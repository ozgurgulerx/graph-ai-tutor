import type { Repositories } from "@graph-ai-tutor/db";
import type { PostSmartAddResolveResponse } from "@graph-ai-tutor/shared";

import type { SmartAddLlm } from "./llm";
import { SmartAddProposalSchema } from "./schema";

export async function runSmartAddResolve(input: {
  repos: Repositories;
  llm: SmartAddLlm;
  title: string;
}): Promise<PostSmartAddResolveResponse> {
  const concepts = await input.repos.concept.listWithNotes();
  const edges = await input.repos.edge.listSummaries();

  const raw = await input.llm.propose({
    title: input.title,
    existingConcepts: concepts.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      module: c.module,
      l0: c.l0
    })),
    existingEdges: edges.map((e) => ({
      fromConceptId: e.fromConceptId,
      toConceptId: e.toConceptId,
      type: e.type
    }))
  });

  const proposal = SmartAddProposalSchema.parse(raw);

  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  // Filter edges referencing non-existent concepts and enrich with titles
  const enrichedEdges = proposal.edges
    .filter((e) => conceptMap.has(e.existingConceptId))
    .map((e) => ({
      existingConceptId: e.existingConceptId,
      existingConceptTitle: conceptMap.get(e.existingConceptId)!.title,
      type: e.type,
      direction: e.direction,
      confidence: e.confidence,
      evidence: e.evidence
    }));

  return {
    kind: proposal.kind,
    l0: proposal.l0,
    l1: proposal.l1,
    module: proposal.module,
    edges: enrichedEdges
  };
}
