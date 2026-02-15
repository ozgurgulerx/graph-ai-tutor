import fs from "node:fs";
import path from "node:path";

export type MigrationResult = {
  applied: string[];
};

export type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
};

export type PgPoolLike = {
  connect: () => Promise<PgClientLike>;
};

function listMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

export async function migrate(pool: PgPoolLike, migrationsDir: string): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at bigint NOT NULL);"
    );

    const appliedRows = (await client.query("SELECT id FROM _migrations ORDER BY id ASC"))
      .rows as Array<{ id: string }>;
    const applied = new Set(appliedRows.map((r) => r.id));

    const files = listMigrationFiles(migrationsDir);
    const newlyApplied: string[] = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (id, applied_at) VALUES ($1, $2)", [
          file,
          Date.now()
        ]);
        await client.query("COMMIT");
        newlyApplied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    return { applied: newlyApplied };
  } finally {
    client.release();
  }
}

