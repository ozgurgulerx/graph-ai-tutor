import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSeedFromFile, openDb } from "@graph-ai-tutor/db";

import { createTestCaptureLlm } from "./capture";
import { createTestDistillLlm } from "./distill";
import { buildServer } from "./server";
import type { VaultWatcher } from "./watcher";

function loadEnvFile(filePath: string) {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    if (!key) continue;
    if (typeof process.env[key] !== "undefined") continue;

    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

// Load `.env` from the repo root for local dev (does not override existing env).
loadEnvFile(path.join(repoRoot, ".env"));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const seedPath = path.join(repoRoot, "fixtures", "seed.graph.json");

async function createMemPool() {
  const { newDb } = await import("pg-mem");
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      "DATABASE_URL not set; using in-memory pg-mem database. Set DATABASE_URL for persistence."
    );
  }

  const db = databaseUrl
    ? await openDb({ connectionString: databaseUrl })
    : await openDb({ pool: await createMemPool() });
  await ensureSeedFromFile(db, seedPath);

  const captureLlm = process.env.NODE_ENV === "test" ? createTestCaptureLlm() : undefined;
  const distillLlm = process.env.NODE_ENV === "test" ? createTestDistillLlm() : undefined;

  const reindexBus = new EventEmitter();
  const vaultDir = process.env.VAULT_DIR;

  // Keep the repo `vault/` as the canonical, checked-in example.
  // Allow tests/e2e to redirect file IO to an ignored `data/` folder.
  const vaultRoot =
    vaultDir ?? process.env.GRAPH_AI_TUTOR_VAULT_DIR ?? path.join(repoRoot, "vault");
  const app = buildServer({ repos: db, captureLlm, distillLlm, reindexBus, vaultRoot });

  let watcher: VaultWatcher | null = null;

  if (vaultDir) {
    const { startVaultWatcher } = await import("./watcher");
    watcher = await startVaultWatcher({
      vaultDir,
      repos: db,
      onReindex: (conceptIds) => {
        reindexBus.emit("reindex", conceptIds);
      }
    });
    // eslint-disable-next-line no-console
    console.log(`Vault watcher started on: ${vaultDir}`);
  }

  app.addHook("onClose", async () => {
    if (watcher) await watcher.close();
    await db.close();
  });

  await app.listen({ port, host });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
