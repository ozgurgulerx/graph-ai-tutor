import path from "node:path";
import { fileURLToPath } from "node:url";

import { openDb } from "@graph-ai-tutor/db";

import { rebuildVaultIndex } from "./rebuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

async function main() {
  const vaultDir = process.env.VAULT_PATH ?? path.join(repoRoot, "vault");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the indexer (it writes to Postgres)");
  }

  const db = await openDb({ connectionString: databaseUrl });
  try {
    const res = await rebuildVaultIndex({ pool: db.pool, vaultDir });
    // eslint-disable-next-line no-console
    console.log(
      `Indexed ${res.filesIndexed} vault files: upserted ${res.conceptsUpserted} concepts, inserted ${res.edgesInserted} edges (deleted concepts=${res.conceptsDeleted}, deleted edges=${res.edgesDeleted}).`
    );
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

