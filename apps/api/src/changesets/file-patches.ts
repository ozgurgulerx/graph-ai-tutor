import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

export type FilePatchItemInput = {
  id: string;
  payload: unknown;
};

export type VaultFileUpdate = {
  path: string;
  content: string;
  contentHash: string;
};

export type ApplyFilePatchesResult = {
  appliedItemIds: string[];
  vaultFileUpdates: VaultFileUpdate[];
  rollback: () => Promise<void>;
};

const FilePatchPayloadSchema = z
  .object({
    filePath: z.string().min(1),
    unifiedDiff: z.string().min(1)
  })
  .strict();

type ParsedHunkLine = { prefix: " " | "+" | "-"; text: string };

type ParsedHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedHunkLine[];
};

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function resolveVaultPath(vaultRoot: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    throw new Error(`Absolute file paths are not allowed: ${filePath}`);
  }
  if (filePath.includes("\u0000")) {
    throw new Error("Invalid file path");
  }
  const absRoot = path.resolve(vaultRoot);
  const abs = path.resolve(absRoot, filePath);
  const rel = path.relative(absRoot, abs);
  if (!rel || rel === "." || rel.startsWith(`..${path.sep}`) || rel === "..") {
    throw new Error(`Invalid vault file path: ${filePath}`);
  }
  return abs;
}

function parseUnifiedDiffHunks(unifiedDiff: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;

  for (const raw of unifiedDiff.split(/\r?\n/)) {
    const line = raw;
    if (!line) continue;
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("diff --git ")) {
      continue;
    }

    const header = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (header) {
      const oldStart = Number(header[1]);
      const oldLines = Number(header[2] ?? "1");
      const newStart = Number(header[3]);
      const newLines = Number(header[4] ?? "1");
      if (!Number.isFinite(oldStart) || !Number.isFinite(newStart)) {
        throw new Error("Invalid hunk header");
      }
      current = { oldStart, oldLines, newStart, newLines, lines: [] };
      hunks.push(current);
      continue;
    }

    if (!current) continue;
    if (line.startsWith("\\ No newline at end of file")) continue;

    const prefix = line[0] as ParsedHunkLine["prefix"];
    if (prefix !== " " && prefix !== "+" && prefix !== "-") {
      throw new Error(`Invalid diff line prefix: ${prefix}`);
    }
    current.lines.push({ prefix, text: line.slice(1) });
  }

  return hunks;
}

function matchesAt(lines: string[], start: number, expected: string[]): boolean {
  if (start < 0) return false;
  if (start + expected.length > lines.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (lines[start + i] !== expected[i]) return false;
  }
  return true;
}

function findHunkStart(lines: string[], expected: string[], preferred: number): number {
  if (matchesAt(lines, preferred, expected)) return preferred;

  const window = 40;
  const maxStart = lines.length - expected.length;
  const from = Math.max(0, preferred - window);
  const to = Math.min(maxStart, preferred + window);

  for (let start = from; start <= to; start += 1) {
    if (matchesAt(lines, start, expected)) return start;
  }

  throw new Error("Hunk context did not match the target file");
}

function applyHunks(content: string, hunks: ParsedHunk[]): string {
  const lines = content.split(/\r?\n/);
  let offset = 0;

  for (const hunk of hunks) {
    const expectedOld = hunk.lines.filter((l) => l.prefix !== "+").map((l) => l.text);
    const replacement = hunk.lines.filter((l) => l.prefix !== "-").map((l) => l.text);

    const preferredStart = hunk.oldStart - 1 + offset;
    const start = findHunkStart(lines, expectedOld, preferredStart);

    lines.splice(start, expectedOld.length, ...replacement);
    offset += replacement.length - expectedOld.length;
  }

  return lines.join("\n");
}

export async function applyAcceptedFilePatchItemsToVault(input: {
  vaultRoot: string;
  items: FilePatchItemInput[];
}): Promise<ApplyFilePatchesResult> {
  const parsedItems = input.items.map((item) => ({
    id: item.id,
    ...FilePatchPayloadSchema.parse(item.payload)
  }));

  const itemsByFile = new Map<
    string,
    Array<{ itemId: string; unifiedDiff: string; hunks: ParsedHunk[] }>
  >();
  for (const item of parsedItems) {
    const hunks = parseUnifiedDiffHunks(item.unifiedDiff);
    if (hunks.length !== 1) {
      throw new Error(`File patch item ${item.id} must contain exactly one hunk`);
    }
    const entry = itemsByFile.get(item.filePath) ?? [];
    entry.push({ itemId: item.id, unifiedDiff: item.unifiedDiff, hunks });
    itemsByFile.set(item.filePath, entry);
  }

  const originals = new Map<string, { existed: boolean; content: string }>();
  const computed = new Map<string, { absPath: string; content: string }>();

  for (const [filePath, entries] of itemsByFile.entries()) {
    const absPath = resolveVaultPath(input.vaultRoot, filePath);

    let original: string;
    try {
      original = fs.readFileSync(absPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Vault file not found: ${filePath}`);
      }
      throw err;
    }

    originals.set(filePath, { existed: true, content: original });

    const ordered = [...entries].sort((a, b) => a.hunks[0].oldStart - b.hunks[0].oldStart);
    const next = applyHunks(
      original.replace(/\r\n/g, "\n"),
      ordered.map((e) => e.hunks[0])
    );
    computed.set(filePath, { absPath, content: next });
  }

  const written: string[] = [];
  const rollback = async () => {
    for (const filePath of written) {
      const absPath = computed.get(filePath)?.absPath;
      if (!absPath) continue;
      const before = originals.get(filePath);
      try {
        if (!before || !before.existed) {
          fs.unlinkSync(absPath);
          continue;
        }
        fs.writeFileSync(absPath, before.content, "utf8");
      } catch {
        // Best-effort rollback; report the original error.
      }
    }
  };

  try {
    for (const [filePath, next] of computed.entries()) {
      fs.mkdirSync(path.dirname(next.absPath), { recursive: true });
      fs.writeFileSync(next.absPath, next.content, "utf8");
      written.push(filePath);
    }
  } catch (err) {
    await rollback();
    throw err;
  }

  const vaultFileUpdates: VaultFileUpdate[] = [...computed.entries()].map(([filePath, next]) => ({
    path: filePath,
    content: next.content,
    contentHash: sha256Hex(next.content)
  }));

  return {
    appliedItemIds: parsedItems.map((i) => i.id),
    vaultFileUpdates,
    rollback
  };
}

