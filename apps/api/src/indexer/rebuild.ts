import crypto from "node:crypto";

import type { PgPoolLike } from "@graph-ai-tutor/db";

import { loadVaultConcepts, type VaultConceptSpec } from "./vault";

export type VaultIndexRebuildResult = {
  filesIndexed: number;
  conceptsUpserted: number;
  conceptsDeleted: number;
  edgesDeleted: number;
  edgesInserted: number;
};

function stableEdgeId(fromId: string, type: string, toId: string): string {
  const hash = crypto.createHash("sha256").update(`${fromId}|${type}|${toId}`).digest("hex");
  return `edge_vault_${hash.slice(0, 24)}`;
}

function placeholders(values: unknown[], startIndex = 1): string {
  return values.map((_, i) => `$${startIndex + i}`).join(", ");
}

function uniq(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function ensureNoIdConflicts(client: { query: PgPoolLike["query"] }, concepts: VaultConceptSpec[]) {
  if (concepts.length === 0) return;
  const ids = concepts.map((c) => c.id);

  const res = await client.query<{ id: string; origin: string }>(
    `SELECT id, origin
     FROM concept
     WHERE id IN (${placeholders(ids)})`,
    ids
  );

  const conflicts = res.rows.filter((r) => r.origin !== "vault").map((r) => r.id);
  if (conflicts.length > 0) {
    throw new Error(`Vault indexer cannot overwrite non-vault concepts: ${conflicts.join(", ")}`);
  }
}

async function deleteVaultEdgesForFiles(
  client: { query: PgPoolLike["query"] },
  filePaths: string[]
): Promise<number> {
  if (filePaths.length === 0) return 0;
  const res = await client.query<{ id: string }>(
    `DELETE FROM edge
     WHERE origin = 'vault' AND file_path IN (${placeholders(filePaths)})
     RETURNING id`,
    filePaths
  );
  return res.rows.length;
}

async function deleteRemovedVaultConcepts(
  client: { query: PgPoolLike["query"] },
  filePaths: string[]
): Promise<number> {
  if (filePaths.length === 0) {
    const res = await client.query<{ id: string }>(
      `DELETE FROM concept
       WHERE origin = 'vault'
       RETURNING id`
    );
    return res.rows.length;
  }

  const res = await client.query<{ id: string }>(
    `DELETE FROM concept
     WHERE origin = 'vault'
       AND (file_path IS NULL OR file_path NOT IN (${placeholders(filePaths)}))
     RETURNING id`,
    filePaths
  );
  return res.rows.length;
}

async function ensureAllEdgeTargetsExist(
  client: { query: PgPoolLike["query"] },
  concepts: VaultConceptSpec[]
) {
  const toIds = uniq(concepts.flatMap((c) => c.edges.map((e) => e.to)));
  if (toIds.length === 0) return;

  const res = await client.query<{ id: string }>(
    `SELECT id
     FROM concept
     WHERE id IN (${placeholders(toIds)})`,
    toIds
  );
  const found = new Set(res.rows.map((r) => r.id));
  const missing = toIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(`Vault edges reference missing concepts: ${missing.join(", ")}`);
  }
}

async function upsertVaultConcept(
  client: { query: PgPoolLike["query"] },
  concept: VaultConceptSpec
): Promise<void> {
  const now = Date.now();
  await client.query(
    `INSERT INTO concept (id, title, kind, l0, l1, l2, module, origin, file_path, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'vault', $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       kind = EXCLUDED.kind,
       l0 = EXCLUDED.l0,
       l1 = EXCLUDED.l1,
       l2 = EXCLUDED.l2,
       module = EXCLUDED.module,
       origin = 'vault',
       file_path = EXCLUDED.file_path,
       updated_at = EXCLUDED.updated_at`,
    [
      concept.id,
      concept.title,
      concept.kind,
      concept.l0,
      concept.l1,
      concept.l2,
      concept.module,
      concept.filePath,
      now,
      now
    ]
  );
}

async function insertVaultEdge(
  client: { query: PgPoolLike["query"] },
  input: { fromId: string; toId: string; type: string; filePath: string }
): Promise<void> {
  await client.query(
    `INSERT INTO edge
     (id, from_concept_id, to_concept_id, type, source_url, confidence, verifier_score, origin, file_path, created_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, NULL, 'vault', $5, $6)`,
    [stableEdgeId(input.fromId, input.type, input.toId), input.fromId, input.toId, input.type, input.filePath, Date.now()]
  );
}

export async function rebuildVaultIndex(options: {
  pool: PgPoolLike;
  vaultDir: string;
}): Promise<VaultIndexRebuildResult> {
  const concepts = loadVaultConcepts(options.vaultDir);

  const seen = new Map<string, string>();
  for (const c of concepts) {
    const prev = seen.get(c.id);
    if (prev) throw new Error(`Duplicate concept id in vault: ${c.id} (${prev}, ${c.filePath})`);
    seen.set(c.id, c.filePath);
  }

  const filePaths = concepts.map((c) => c.filePath);

  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await ensureNoIdConflicts(client, concepts);

      for (const concept of concepts) {
        await upsertVaultConcept(client, concept);
      }

      const edgesDeleted = await deleteVaultEdgesForFiles(client, filePaths);

      await ensureAllEdgeTargetsExist(client, concepts);

      let edgesInserted = 0;
      for (const concept of concepts) {
        for (const edge of concept.edges) {
          await insertVaultEdge(client, {
            fromId: concept.id,
            toId: edge.to,
            type: edge.type,
            filePath: concept.filePath
          });
          edgesInserted += 1;
        }
      }

      const conceptsDeleted = await deleteRemovedVaultConcepts(client, filePaths);

      await client.query("COMMIT");

      return {
        filesIndexed: filePaths.length,
        conceptsUpserted: concepts.length,
        conceptsDeleted,
        edgesDeleted,
        edgesInserted
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

