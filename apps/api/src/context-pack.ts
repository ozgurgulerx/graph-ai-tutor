import type { Repositories } from "@graph-ai-tutor/db";
import { computePrerequisitePath, type ContextPackRadius, type EdgeSummary } from "@graph-ai-tutor/shared";

export type ContextPackOptions = {
  conceptId: string;
  radius: ContextPackRadius;
  includeCode: boolean;
  includeQuiz: boolean;
};

const QUIZ_TYPE_SET = new Set(["CLOZE", "ORDERING_STEPS", "COMPARE_CONTRAST"]);

/**
 * BFS from `startId` across all edge types (undirected) up to `maxHops`.
 */
function bfsCollect(
  startId: string,
  edges: ReadonlyArray<Pick<EdgeSummary, "fromConceptId" | "toConceptId">>,
  maxHops: number
): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adjacency.has(e.fromConceptId)) adjacency.set(e.fromConceptId, new Set());
    if (!adjacency.has(e.toConceptId)) adjacency.set(e.toConceptId, new Set());
    adjacency.get(e.fromConceptId)!.add(e.toConceptId);
    adjacency.get(e.toConceptId)!.add(e.fromConceptId);
  }

  const visited = new Set<string>([startId]);
  let frontier = [startId];

  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return visited;
}

export async function collectConceptIds(
  repos: Repositories,
  opts: ContextPackOptions
): Promise<string[]> {
  const allEdges = await repos.edge.listSummaries();

  if (opts.radius === "prereq-path") {
    const result = computePrerequisitePath({
      targetConceptId: opts.conceptId,
      edges: allEdges
    });
    if (result.ok) {
      return result.orderedConceptIds;
    }
    // Fallback on cycle: return just the target
    return [opts.conceptId];
  }

  const maxHops = opts.radius === "2-hop" ? 2 : 1;
  const conceptIdSet = bfsCollect(opts.conceptId, allEdges, maxHops);
  return [...conceptIdSet];
}

export async function generateContextPack(
  repos: Repositories,
  opts: ContextPackOptions
): Promise<{ markdown: string; fileName: string; conceptIds: string[] }> {
  const conceptIds = await collectConceptIds(repos, opts);

  // Fetch full concept details
  const concepts = (
    await Promise.all(conceptIds.map((id) => repos.concept.getById(id)))
  ).filter((c) => c !== null);

  // Fetch edges between collected concepts
  const relevantEdges =
    conceptIds.length > 0
      ? await repos.edge.listSummariesByConceptIds(conceptIds, 5000)
      : [];
  const conceptIdSet = new Set(conceptIds);
  const internalEdges = relevantEdges.filter(
    (e) => conceptIdSet.has(e.fromConceptId) && conceptIdSet.has(e.toConceptId)
  );

  // Build title lookup
  const titleById = new Map(concepts.map((c) => [c.id, c.title]));

  // Optionally fetch quizzes per concept
  const quizzesByConcept = new Map<
    string,
    Array<{ type: string; prompt: string; answer: unknown }>
  >();
  if (opts.includeQuiz) {
    for (const c of concepts) {
      const items = await repos.reviewItem.listByConceptId(c.id, 200);
      const quizzes = items.filter(
        (i) => QUIZ_TYPE_SET.has(i.type) && i.answer !== null && i.rubric !== null
      );
      if (quizzes.length > 0) {
        quizzesByConcept.set(
          c.id,
          quizzes.map((q) => ({ type: q.type, prompt: q.prompt, answer: q.answer }))
        );
      }
    }
  }

  // Build markdown
  const lines: string[] = [];
  const rootConcept = concepts.find((c) => c.id === opts.conceptId);
  const rootTitle = rootConcept?.title ?? opts.conceptId;

  lines.push(`# Context Pack: ${rootTitle}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Radius: ${opts.radius}`);
  lines.push(`Concepts included: ${concepts.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const c of concepts) {
    lines.push(`## ${c.title}`);
    lines.push(
      `**Kind**: ${c.kind ?? "Concept"}${c.module ? ` | **Module**: ${c.module}` : ""}`
    );
    lines.push("");

    if (c.l0) {
      lines.push("### Definition");
      lines.push(c.l0);
      lines.push("");
    }

    if (c.l1.length > 0) {
      lines.push("### Summary (L1)");
      for (const bullet of c.l1) {
        lines.push(`- ${bullet}`);
      }
      lines.push("");
    }

    if (c.l2.length > 0) {
      lines.push("### Details (L2)");
      for (const step of c.l2) {
        lines.push(`- ${step}`);
      }
      lines.push("");
    }

    // Relationships
    const outgoing = internalEdges.filter((e) => e.fromConceptId === c.id);
    const incoming = internalEdges.filter((e) => e.toConceptId === c.id);
    if (outgoing.length > 0 || incoming.length > 0) {
      lines.push("### Relationships");
      for (const e of outgoing) {
        lines.push(`- ${e.type} -> ${titleById.get(e.toConceptId) ?? e.toConceptId}`);
      }
      for (const e of incoming) {
        lines.push(
          `- ${titleById.get(e.fromConceptId) ?? e.fromConceptId} -[${e.type}]-> (this)`
        );
      }
      lines.push("");
    }

    // Quizzes
    if (opts.includeQuiz && quizzesByConcept.has(c.id)) {
      lines.push("### Quizzes");
      for (const q of quizzesByConcept.get(c.id)!) {
        lines.push(`**${q.type}**: ${q.prompt}`);
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  const markdown = lines.join("\n");
  const timestamp = Date.now();
  const safeTitle = rootTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const fileName = `${safeTitle}-${opts.radius}-${timestamp}.md`;

  return { markdown, fileName, conceptIds };
}
