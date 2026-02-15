import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import { migrate } from "./migrate";
import { createRepositories, type PgPoolLike, type Repositories } from "./repositories";

export { migrate } from "./migrate";
export * from "./repositories";
export { ensureSeedFromFile, seedFromFile, seedFromObject } from "./seed";

export const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

export type OpenDbOptions = {
  pool?: PgPoolLike;
  connectionString?: string;
  migrationsDir?: string;
  runMigrations?: boolean;
};

export type Db = Repositories & {
  pool: PgPoolLike;
  close: () => Promise<void>;
};

export async function openDb(options: OpenDbOptions = {}): Promise<Db> {
  const pool = options.pool ?? (() => {
    const connectionString = options.connectionString ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required (or pass an explicit Pool via openDb({ pool }))");
    }
    return new Pool({ connectionString });
  })();

  if (options.runMigrations ?? true) {
    await migrate(pool, options.migrationsDir ?? migrationsDir);
  }

  const repos = createRepositories(pool);

  return {
    pool,
    ...repos,
    async close() {
      const maybeEnd = (pool as unknown as { end?: () => Promise<void> | void }).end;
      if (typeof maybeEnd === "function") {
        await maybeEnd();
      }
    }
  };
}
