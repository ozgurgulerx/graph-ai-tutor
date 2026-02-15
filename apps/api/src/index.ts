import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSeedFromFile, openDb } from "@graph-ai-tutor/db";

import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const defaultDatabaseUrl = "postgres://graph:graph@localhost:5432/graph_ai_tutor";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const seedPath = path.join(repoRoot, "fixtures", "seed.graph.json");

async function main() {
  const db = await openDb({ connectionString: databaseUrl });
  await ensureSeedFromFile(db, seedPath);

  const app = buildServer({ repos: db });

  app.addHook("onClose", async () => {
    await db.close();
  });

  await app.listen({ port, host });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

