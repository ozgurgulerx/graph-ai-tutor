import fs from "node:fs";

import type {
  ChangesetItemStatus,
  ChangesetStatus,
  EdgeType,
  Repositories,
  ReviewItemStatus
} from "./repositories";

export type SeedGraph = {
  concepts: Array<{
    id: string;
    title: string;
    l0?: string | null;
    l1?: string[];
    module?: string | null;
  }>;
  sources: Array<{
    id: string;
    url: string;
    title?: string | null;
  }>;
  chunks: Array<{
    id: string;
    sourceId: string;
    content: string;
    startOffset?: number;
    endOffset?: number;
  }>;
  edges: Array<{
    id: string;
    fromConceptId: string;
    toConceptId: string;
    type: EdgeType;
    sourceUrl?: string | null;
    confidence?: number | null;
    verifierScore?: number | null;
    evidenceChunkIds: string[];
  }>;
  changesets?: Array<{
    id: string;
    sourceId?: string | null;
    status?: ChangesetStatus;
  }>;
  changesetItems?: Array<{
    id: string;
    changesetId: string;
    entityType: string;
    action: string;
    status?: ChangesetItemStatus;
    payload: unknown;
  }>;
  reviewItems?: Array<{
    id: string;
    conceptId?: string | null;
    type: string;
    prompt: string;
    answer?: unknown;
    rubric?: unknown;
    status?: ReviewItemStatus;
    dueAt?: number | null;
  }>;
};

type SeedTarget = Repositories;

export async function seedFromObject(target: SeedTarget, seed: SeedGraph): Promise<void> {
  for (const concept of seed.concepts) {
    await target.concept.create(concept);
  }

  for (const source of seed.sources) {
    await target.source.create(source);
  }

  for (const chunk of seed.chunks) {
    await target.chunk.create(chunk);
  }

  for (const edge of seed.edges) {
    await target.edge.create(edge);
  }

  for (const changeset of seed.changesets ?? []) {
    await target.changeset.create(changeset);
  }

  for (const item of seed.changesetItems ?? []) {
    await target.changesetItem.create(item);
  }

  for (const item of seed.reviewItems ?? []) {
    await target.reviewItem.create(item);
  }
}

export async function seedFromFile(target: SeedTarget, seedPath: string): Promise<void> {
  if ((await target.concept.count()) > 0) {
    throw new Error("Refusing to seed a non-empty database");
  }
  const raw = fs.readFileSync(seedPath, "utf8");
  const parsed = JSON.parse(raw) as SeedGraph;
  await seedFromObject(target, parsed);
}

export async function ensureSeedFromFile(target: SeedTarget, seedPath: string): Promise<boolean> {
  const n = await target.concept.count();
  if (n > 0) return false;
  await seedFromFile(target, seedPath);
  return true;
}
