import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";

import { openDb } from "@graph-ai-tutor/db";

import { indexFile } from "./indexer";
import { parseMdFile } from "./parser";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

describe("indexFile", () => {
  it("creates a new concept from .md frontmatter", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const content = `---
title: KV Cache
kind: Concept
module: inference
---
Body text about KV caching.`;

      const parsed = parseMdFile(content);
      const result = await indexFile(db, "/vault/kv-cache.md", parsed);

      expect(result.created).toBe(true);
      expect(result.conceptId).toBeTruthy();

      const concept = await db.concept.getById(result.conceptId);
      expect(concept).not.toBeNull();
      expect(concept!.title).toBe("KV Cache");
      expect(concept!.kind).toBe("Concept");
      expect(concept!.module).toBe("inference");
    } finally {
      await db.close();
    }
  });

  it("updates an existing concept by title match", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const existing = await db.concept.create({
        title: "KV Cache",
        kind: "Concept",
        module: "old-module"
      });

      const content = `---
title: KV Cache
module: inference
---
Updated body.`;

      const parsed = parseMdFile(content);
      const result = await indexFile(db, "/vault/kv-cache.md", parsed);

      expect(result.created).toBe(false);
      expect(result.conceptId).toBe(existing.id);

      const updated = await db.concept.getById(existing.id);
      expect(updated!.module).toBe("inference");
    } finally {
      await db.close();
    }
  });

  it("creates edges from wiki-links when target concepts exist", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      await db.concept.create({ title: "Attention" });

      const content = `---
title: Multi-Head Attention
---
This uses [[Attention]] mechanism.`;

      const parsed = parseMdFile(content);
      const result = await indexFile(db, "/vault/mha.md", parsed);

      expect(result.edgesCreated).toBe(1);

      const edges = await db.edge.listSummaries();
      const edge = edges.find((e) => e.type === "USED_IN");
      expect(edge).toBeTruthy();
      expect(edge!.fromConceptId).toBe(result.conceptId);
    } finally {
      await db.close();
    }
  });

  it("derives title from file path when no frontmatter title", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    try {
      const content = "Just some text without frontmatter.";
      const parsed = parseMdFile(content);
      const result = await indexFile(db, "/vault/process-supervision.md", parsed);

      const concept = await db.concept.getById(result.conceptId);
      expect(concept!.title).toBe("Process Supervision");
    } finally {
      await db.close();
    }
  });
});
