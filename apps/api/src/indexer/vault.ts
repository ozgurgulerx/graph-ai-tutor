import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { EdgeTypeSchema, NodeKindSchema } from "@graph-ai-tutor/shared";

const VaultEdgeSchema = z
  .object({
    to: z.string().min(1),
    type: EdgeTypeSchema
  })
  .strict();

export const VaultConceptFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: NodeKindSchema.optional().default("Concept"),
    module: z.string().nullable().optional().default(null),
    l0: z.string().nullable().optional().default(null),
    l1: z.array(z.string()).optional().default([]),
    l2: z.array(z.string()).optional().default([]),
    edges: z.array(VaultEdgeSchema).optional().default([])
  })
  .strict();

export type VaultConceptFrontmatter = z.infer<typeof VaultConceptFrontmatterSchema>;

export type VaultConceptSpec = VaultConceptFrontmatter & {
  filePath: string;
  absPath: string;
};

function normalizeFilePath(value: string): string {
  return value.split(path.sep).join("/");
}

export function listVaultMarkdownFiles(vaultDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [vaultDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".md")) continue;
      out.push(abs);
    }
  }

  out.sort((a, b) => normalizeFilePath(a).localeCompare(normalizeFilePath(b)));
  return out;
}

function extractFrontmatter(markdown: string): { raw: string; rest: string } {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0 || lines[0]?.trim() !== "---") {
    throw new Error("Missing YAML frontmatter (expected leading '---' line)");
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error("Unterminated YAML frontmatter (missing closing '---')");

  const raw = lines.slice(1, end).join("\n");
  const rest = lines.slice(end + 1).join("\n");
  return { raw, rest };
}

function parseScalar(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null;
  if (v === "null") return null;
  if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (indent !== 0) {
      throw new Error(`Unexpected indentation at line ${i + 1}`);
    }

    const colon = line.indexOf(":");
    if (colon <= 0) throw new Error(`Invalid key at line ${i + 1}`);

    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();

    if (rest !== "") {
      out[key] = parseScalar(rest);
      i++;
      continue;
    }

    if (key === "l1" || key === "l2") {
      const items: string[] = [];
      i++;
      while (i < lines.length) {
        const rawLine = lines[i] ?? "";
        const t = rawLine.trim();
        if (!t || t.startsWith("#")) {
          i++;
          continue;
        }

        const ind = rawLine.length - rawLine.trimStart().length;
        if (ind < 2) break;

        if (!t.startsWith("-")) throw new Error(`Expected list item for ${key} at line ${i + 1}`);
        const value = t.replace(/^-\s*/, "");
        items.push(parseScalar(value) ?? "");
        i++;
      }

      out[key] = items;
      continue;
    }

    if (key === "edges") {
      const edges: Array<Record<string, unknown>> = [];
      i++;
      while (i < lines.length) {
        const rawLine = lines[i] ?? "";
        const t = rawLine.trim();
        if (!t || t.startsWith("#")) {
          i++;
          continue;
        }

        const ind = rawLine.length - rawLine.trimStart().length;
        if (ind < 2) break;

        if (!t.startsWith("-")) throw new Error(`Expected list item for edges at line ${i + 1}`);
        const afterDash = t.replace(/^-\s*/, "");
        const edge: Record<string, unknown> = {};

        if (afterDash) {
          const idx = afterDash.indexOf(":");
          if (idx <= 0) throw new Error(`Invalid edge item at line ${i + 1}`);
          const k = afterDash.slice(0, idx).trim();
          const v = afterDash.slice(idx + 1).trim();
          edge[k] = parseScalar(v);
        }

        i++;

        while (i < lines.length) {
          const rawLine2 = lines[i] ?? "";
          const t2 = rawLine2.trim();
          if (!t2 || t2.startsWith("#")) {
            i++;
            continue;
          }

          const ind2 = rawLine2.length - rawLine2.trimStart().length;
          if (ind2 < 4) break;

          const idx2 = t2.indexOf(":");
          if (idx2 <= 0) throw new Error(`Invalid edge field at line ${i + 1}`);
          const k2 = t2.slice(0, idx2).trim();
          const v2 = t2.slice(idx2 + 1).trim();
          edge[k2] = parseScalar(v2);
          i++;
        }

        edges.push(edge);
      }

      out.edges = edges;
      continue;
    }

    // For known scalar keys, `key:` means null.
    out[key] = null;
    i++;
  }

  return out;
}

export function parseVaultMarkdown(markdown: string): VaultConceptFrontmatter {
  const { raw } = extractFrontmatter(markdown);

  let parsedYaml: unknown;
  try {
    parsedYaml = parseSimpleYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid YAML";
    throw new Error(`Invalid YAML frontmatter: ${msg}`);
  }

  const res = VaultConceptFrontmatterSchema.safeParse(parsedYaml);
  if (!res.success) {
    const message = res.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
    throw new Error(`Invalid vault frontmatter: ${message}`);
  }

  return res.data;
}

export function loadVaultConcepts(vaultDir: string): VaultConceptSpec[] {
  const absVault = path.resolve(vaultDir);
  const files = listVaultMarkdownFiles(absVault);

  const concepts: VaultConceptSpec[] = [];
  for (const absPath of files) {
    const content = fs.readFileSync(absPath, "utf8");
    const frontmatter = parseVaultMarkdown(content);
    const rel = normalizeFilePath(path.relative(absVault, absPath));
    concepts.push({ ...frontmatter, filePath: rel, absPath });
  }

  return concepts;
}
