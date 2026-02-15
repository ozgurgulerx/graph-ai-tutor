import type { Repositories } from "@graph-ai-tutor/db";
import type { ParsedMdFile } from "./parser";

export type IndexFileResult = {
  conceptId: string;
  created: boolean;
  edgesCreated: number;
};

export async function indexFile(
  repos: Repositories,
  filePath: string,
  parsed: ParsedMdFile
): Promise<IndexFileResult> {
  const fm = parsed.frontmatter;
  const title = fm.title || titleFromPath(filePath);

  let concept = fm.id ? await repos.concept.getById(fm.id) : null;
  if (!concept) {
    const searchResults = await repos.concept.searchSummaries(title, 1);
    const exactMatch = searchResults.find(
      (r) => r.title.toLowerCase() === title.toLowerCase()
    );
    if (exactMatch) {
      concept = await repos.concept.getById(exactMatch.id);
    }
  }

  let created = false;
  if (concept) {
    await repos.concept.update({
      id: concept.id,
      ...(fm.title ? { title: fm.title } : {}),
      ...(fm.kind ? { kind: fm.kind } : {}),
      ...(fm.module !== undefined ? { module: fm.module } : {})
    });
  } else {
    concept = await repos.concept.create({
      id: fm.id,
      title,
      kind: fm.kind ?? "Concept",
      module: fm.module ?? null
    });
    created = true;
  }

  let edgesCreated = 0;

  // Process explicit edges from frontmatter
  if (fm.edges) {
    for (const edgeDef of fm.edges) {
      const targetConcept = await findConceptByTitle(repos, edgeDef.target);
      if (!targetConcept || targetConcept.id === concept.id) continue;
      try {
        await repos.edge.create({
          fromConceptId: concept.id,
          toConceptId: targetConcept.id,
          type: edgeDef.type
        });
        edgesCreated++;
      } catch {
        // Edge might already exist
      }
    }
  }

  // Process wiki-links as USED_IN edges
  for (const linkTitle of parsed.wikiLinks) {
    const targetConcept = await findConceptByTitle(repos, linkTitle);
    if (!targetConcept || targetConcept.id === concept.id) continue;
    try {
      await repos.edge.create({
        fromConceptId: concept.id,
        toConceptId: targetConcept.id,
        type: "USED_IN"
      });
      edgesCreated++;
    } catch {
      // Edge might already exist
    }
  }

  return { conceptId: concept.id, created, edgesCreated };
}

export async function reindexBacklinks(
  repos: Repositories,
  conceptId: string,
  backlinkConceptIds: string[]
): Promise<string[]> {
  const reindexed: string[] = [];
  for (const blId of backlinkConceptIds) {
    if (blId === conceptId) continue;
    reindexed.push(blId);
  }
  return reindexed;
}

async function findConceptByTitle(
  repos: Repositories,
  title: string
): Promise<{ id: string } | null> {
  const results = await repos.concept.searchSummaries(title, 5);
  return (
    results.find((r) => r.title.toLowerCase() === title.toLowerCase()) ?? null
  );
}

function titleFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base
    .replace(/\.md$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
