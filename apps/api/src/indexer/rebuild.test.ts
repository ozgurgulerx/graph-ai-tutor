import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { openDb } from "@graph-ai-tutor/db";

import { rebuildVaultIndex } from "./rebuild";

function createMemPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

function writeVaultFile(dir: string, relPath: string, content: string) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
}

describe("vault indexer", () => {
  it("populates concepts/edges from vault, is idempotent, and deletes removed files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "graph-ai-tutor-vault-"));

    writeVaultFile(
      tmp,
      "a.md",
      `---
id: concept_vault_a
title: A
module: test
edges:
  - to: concept_vault_b
    type: PREREQUISITE_OF
---

# A
`
    );

    writeVaultFile(
      tmp,
      "b.md",
      `---
id: concept_vault_b
title: B
module: test
---

# B
`
    );

    const db = await openDb({ pool: createMemPool() });
    try {
      await rebuildVaultIndex({ pool: db.pool, vaultDir: tmp });

      const concepts1 = await db.pool.query<{ id: string; origin: string; file_path: string | null }>(
        "SELECT id, origin, file_path FROM concept WHERE origin = 'vault' ORDER BY id ASC"
      );
      expect(concepts1.rows.map((r) => r.id)).toEqual(["concept_vault_a", "concept_vault_b"]);
      expect(concepts1.rows.every((r) => r.origin === "vault")).toBe(true);
      expect(concepts1.rows.map((r) => r.file_path)).toEqual(["a.md", "b.md"]);

      const edges1 = await db.pool.query<{ id: string; origin: string; file_path: string | null }>(
        "SELECT id, origin, file_path FROM edge WHERE origin = 'vault' ORDER BY id ASC"
      );
      expect(edges1.rows).toHaveLength(1);
      expect(edges1.rows[0]?.origin).toBe("vault");
      expect(edges1.rows[0]?.file_path).toBe("a.md");

      // Idempotent: re-running shouldn't create duplicates.
      await rebuildVaultIndex({ pool: db.pool, vaultDir: tmp });
      const concepts2 = await db.pool.query<{ n: number }>(
        "SELECT COUNT(1)::int AS n FROM concept WHERE origin = 'vault'"
      );
      expect(concepts2.rows[0]?.n).toBe(2);
      const edges2 = await db.pool.query<{ n: number }>(
        "SELECT COUNT(1)::int AS n FROM edge WHERE origin = 'vault'"
      );
      expect(edges2.rows[0]?.n).toBe(1);

      // Remove a file and re-run: it should delete the concept and its edges.
      fs.unlinkSync(path.join(tmp, "b.md"));
      await rebuildVaultIndex({ pool: db.pool, vaultDir: tmp });

      const concepts3 = await db.pool.query<{ id: string }>(
        "SELECT id FROM concept WHERE origin = 'vault' ORDER BY id ASC"
      );
      expect(concepts3.rows.map((r) => r.id)).toEqual(["concept_vault_a"]);
      const edges3 = await db.pool.query<{ n: number }>(
        "SELECT COUNT(1)::int AS n FROM edge WHERE origin = 'vault'"
      );
      expect(edges3.rows[0]?.n).toBe(0);
    } finally {
      await db.close();
    }
  });
});

