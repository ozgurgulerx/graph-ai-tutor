import type { NodeKind, EdgeType } from "@graph-ai-tutor/db";

export type ParsedFrontmatter = {
  id?: string;
  title?: string;
  kind?: NodeKind;
  tags?: string[];
  module?: string;
  edges?: { type: EdgeType; target: string }[];
};

export type ParsedMdFile = {
  frontmatter: ParsedFrontmatter;
  wikiLinks: string[];
  body: string;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

function parseFrontmatterValue(raw: string): string | string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((v) => v.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

const NODE_KIND_SET = new Set<string>([
  "Domain", "Concept", "Method", "Architecture", "Pattern", "Threat",
  "Control", "Metric", "Benchmark", "Protocol", "Standard", "Regulation",
  "Tool", "System", "Artifact", "Question"
]);

const EDGE_TYPE_SET = new Set<string>([
  "PREREQUISITE_OF", "PART_OF", "USED_IN", "CONTRASTS_WITH",
  "ADDRESSES_FAILURE_MODE", "INTRODUCED_BY", "POPULARIZED_BY",
  "CONFUSED_WITH", "IS_A", "ENABLES", "REQUIRES", "OPTIMIZED_BY",
  "TRAINED_WITH", "ALIGNED_WITH", "EVALUATED_BY", "INSTRUMENTED_BY",
  "ATTACKED_BY", "MITIGATED_BY", "GOVERNED_BY", "STANDARDIZED_BY",
  "PRODUCES", "CONSUMES", "HAS_MAJOR_AREA", "ANSWERED_BY",
  "INSTANCE_OF", "ADVANCES", "COMPETES_WITH", "DEPENDS_ON"
]);

function parseEdgeLine(line: string): { type: EdgeType; target: string } | null {
  const match = line.match(/^(\S+)\s+(.+)$/);
  if (!match) return null;
  const type = match[1]!;
  const target = match[2]!.trim();
  if (!EDGE_TYPE_SET.has(type) || !target) return null;
  return { type: type as EdgeType, target };
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return {};

  const block = match[1]!;
  const result: ParsedFrontmatter = {};

  for (const line of block.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const rawValue = line.slice(idx + 1);

    switch (key) {
      case "id":
        result.id = String(parseFrontmatterValue(rawValue));
        break;
      case "title":
        result.title = String(parseFrontmatterValue(rawValue));
        break;
      case "kind": {
        const val = String(parseFrontmatterValue(rawValue));
        if (NODE_KIND_SET.has(val)) result.kind = val as NodeKind;
        break;
      }
      case "module":
        result.module = String(parseFrontmatterValue(rawValue));
        break;
      case "tags": {
        const val = parseFrontmatterValue(rawValue);
        result.tags = Array.isArray(val) ? val : [val];
        break;
      }
      case "edges": {
        const val = parseFrontmatterValue(rawValue);
        const lines = Array.isArray(val) ? val : [val];
        const edges: { type: EdgeType; target: string }[] = [];
        for (const edgeLine of lines) {
          const parsed = parseEdgeLine(edgeLine);
          if (parsed) edges.push(parsed);
        }
        if (edges.length > 0) result.edges = edges;
        break;
      }
    }
  }

  return result;
}

export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(content)) !== null) {
    const target = match[1]!.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }
  return links;
}

export function parseMdFile(content: string): ParsedMdFile {
  const frontmatter = parseFrontmatter(content);
  const fmMatch = content.match(FRONTMATTER_RE);
  const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content.trim();
  const wikiLinks = extractWikiLinks(body);
  return { frontmatter, wikiLinks, body };
}
