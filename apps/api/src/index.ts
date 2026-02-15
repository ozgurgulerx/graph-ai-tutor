import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSeedFromFile, openDb } from "@graph-ai-tutor/db";

import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
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
