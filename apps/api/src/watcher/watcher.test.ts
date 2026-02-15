import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";

import { openDb } from "@graph-ai-tutor/db";

import { startVaultWatcher } from "./watcher";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("startVaultWatcher", () => {
  it("indexes a new .md file written to the vault dir", async () => {
    const pool = createMemPool();
    const db = await openDb({ pool });
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));

    let reindexedIds: string[] = [];

    const watcher = await startVaultWatcher({
      vaultDir: tmpDir,
      repos: db,
      onReindex: (ids) => {
        reindexedIds = [...reindexedIds, ...ids];
      }
    });

    try {
      const content = `---
title: Test Concept
kind: Concept
module: testing
---
Some body text.`;

      await fs.writeFile(path.join(tmpDir, "test-concept.md"), content, "utf8");

      // Wait for chokidar to detect + stabilityThreshold + processing
      await sleep(1500);

      expect(reindexedIds.length).toBeGreaterThan(0);

      const concepts = await db.concept.listSummaries();
      const found = concepts.find((c) => c.title === "Test Concept");
      expect(found).toBeTruthy();
      expect(found!.module).toBe("testing");
    } finally {
      await watcher.close();
      await db.close();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }, 10_000);
});
