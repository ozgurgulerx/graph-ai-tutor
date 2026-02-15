import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

export function getVaultDir(): string {
  const raw = process.env.GRAPH_AI_TUTOR_VAULT_DIR;
  const base = raw && raw.trim() ? raw.trim() : path.join(repoRoot, "vault");
  return path.isAbsolute(base) ? base : path.resolve(repoRoot, base);
}

export function isVaultUrl(url: string): boolean {
  return url.startsWith("vault://");
}

export function resolveVaultUrlToPath(vaultUrl: string): { absPath: string; relPath: string } {
  let u: URL;
  try {
    u = new URL(vaultUrl);
  } catch {
    throw new Error("Invalid vault URL");
  }

  if (u.protocol !== "vault:") {
    throw new Error("Not a vault URL");
  }

  const host = u.hostname.trim();
  if (!host) throw new Error("Vault URL must include a host (e.g. vault://sources/...)");

  const pathname = decodeURIComponent(u.pathname ?? "");
  const rel = path.join(host, pathname.replace(/^\/+/, ""));
  const relPath = path.normalize(rel);

  if (!relPath || relPath === "." || relPath.startsWith("..") || path.isAbsolute(relPath)) {
    throw new Error("Unsafe vault path");
  }

  const vaultDir = path.resolve(getVaultDir());
  const absPath = path.resolve(vaultDir, relPath);

  if (absPath !== vaultDir && !absPath.startsWith(`${vaultDir}${path.sep}`)) {
    throw new Error("Resolved path escapes vault dir");
  }

  return { absPath, relPath };
}

export async function readVaultTextFile(vaultUrl: string): Promise<string> {
  const { absPath } = resolveVaultUrlToPath(vaultUrl);
  return fs.readFile(absPath, "utf8");
}

export async function writeVaultTextFileAtomic(vaultUrl: string, content: string): Promise<void> {
  const { absPath } = resolveVaultUrlToPath(vaultUrl);
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const tmp = `${absPath}.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, absPath);
}

