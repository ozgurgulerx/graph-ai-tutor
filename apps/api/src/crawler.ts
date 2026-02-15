import crypto from "node:crypto";

export function parseAllowlistDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/g)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, "");
}

function isHostAllowed(host: string, allowlistDomains: string[]): boolean {
  const h = normalizeHost(host);
  if (!h) return false;

  for (const entryRaw of allowlistDomains) {
    const entry = normalizeHost(entryRaw);
    if (!entry) continue;

    if (entry.startsWith("*.")) {
      const suffix = entry.slice(2);
      if (!suffix) continue;
      if (h === suffix || h.endsWith(`.${suffix}`)) return true;
      continue;
    }

    if (h === entry || h.endsWith(`.${entry}`)) return true;
  }

  return false;
}

export function isUrlAllowed(url: string, allowlistDomains: string[]): boolean {
  const u = new URL(url);
  return isHostAllowed(u.hostname, allowlistDomains);
}

export function normalizeUrl(input: string): string {
  const u = new URL(input);

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported");
  }

  // Drop fragments; they're not part of the fetched resource.
  u.hash = "";

  // Normalize host casing, plus strip default ports.
  u.hostname = normalizeHost(u.hostname);
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }

  // Canonicalize query ordering for stable dedupe.
  u.searchParams.sort();

  // Normalize trailing slash (except for root).
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}

export function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function htmlToText(html: string): string {
  // v1: best-effort extraction without dependencies.
  let text = html;

  // Drop script/style/noscript blocks.
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  // Convert common block-ish tags to newlines.
  text = text.replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|pre|code|br)>/gi, "\n");

  // Strip remaining tags.
  text = text.replace(/<[^>]+>/g, " ");

  // Minimal entity decoding (keep it small; quality is not the goal in v1).
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, "\"");
  text = text.replace(/&#39;/gi, "'");

  // Collapse whitespace.
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export type TextChunk = {
  content: string;
  startOffset: number;
  endOffset: number;
};

export function chunkText(
  text: string,
  options: { maxChars?: number; overlapChars?: number; maxChunks?: number } = {}
): TextChunk[] {
  const maxChars = options.maxChars ?? 2000;
  const overlapChars = Math.min(options.overlapChars ?? 200, maxChars - 1);
  const maxChunks = options.maxChunks ?? 50;

  const cleaned = text.trim();
  if (!cleaned) return [];

  const chunks: TextChunk[] = [];
  const step = maxChars - overlapChars;

  for (let start = 0; start < cleaned.length && chunks.length < maxChunks; start += step) {
    const end = Math.min(cleaned.length, start + maxChars);
    const content = cleaned.slice(start, end).trim();
    if (!content) continue;
    chunks.push({ content, startOffset: start, endOffset: end });
  }

  return chunks;
}

export async function fetchTextContent(inputUrl: string, options: { maxBytes?: number } = {}) {
  const maxBytes = options.maxBytes ?? 2_000_000;

  const res = await fetch(inputUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "graph-ai-tutor-crawler/1.0"
    }
  });

  const contentType = res.headers.get("content-type");
  const finalUrl = res.url || inputUrl;

  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    throw new Error(`Response too large (${ab.byteLength} bytes > ${maxBytes})`);
  }

  const text = new TextDecoder("utf-8").decode(ab);
  return { finalUrl, contentType, text };
}

