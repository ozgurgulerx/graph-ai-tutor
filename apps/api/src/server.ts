import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

import Fastify from "fastify";
import type { FastifyReply } from "fastify";

import type { Repositories } from "@graph-ai-tutor/db";
import {
  GetConceptParamsSchema,
  GetConceptResponseSchema,
  GraphResponseSchema,
  IngestRequestSchema,
  IngestResponseSchema,
  PostConceptRequestSchema,
  PostConceptResponseSchema,
  PostEdgeRequestSchema,
  PostEdgeResponseSchema,
  SearchQuerySchema,
  SearchResponseSchema
} from "@graph-ai-tutor/shared";

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues?: unknown } };

type ZodSchema<T> = {
  safeParse(input: unknown): SafeParseResult<T>;
};

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  reply.status(statusCode).send({
    error: {
      code,
      message,
      ...(typeof details === "undefined" ? {} : { details })
    }
  });
}

function parseOr400<T>(reply: FastifyReply, schema: ZodSchema<T>, input: unknown): T | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  sendError(reply, 400, "VALIDATION_ERROR", "Invalid request", parsed.error.issues);
  return null;
}

type ChunkedText = {
  content: string;
  startOffset: number;
  endOffset: number;
};

function chunkText(
  text: string,
  options: { minLen: number; maxLen: number; overlap: number } = {
    minLen: 800,
    maxLen: 1200,
    overlap: 200
  }
): ChunkedText[] {
  const cleaned = text.replaceAll(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const chunks: ChunkedText[] = [];
  const n = cleaned.length;
  let start = 0;

  while (start < n) {
    const windowEnd = Math.min(start + options.maxLen, n);
    let end = windowEnd;

    if (windowEnd < n) {
      const minEnd = Math.min(start + options.minLen, n);
      const slice = cleaned.slice(minEnd, windowEnd);
      const lastSpace = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"), slice.lastIndexOf("\t"));
      if (lastSpace >= 0) end = minEnd + lastSpace;
    }

    if (end <= start) end = windowEnd;

    const content = cleaned.slice(start, end).trim();
    if (content) {
      chunks.push({ content, startOffset: start, endOffset: end });
    }

    if (end >= n) break;
    start = Math.max(0, end - options.overlap);
  }

  return chunks;
}

function decodePdfLiteralString(input: string): string {
  // Input is the full "(...)" literal including parentheses.
  const inner = input.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = inner[i + 1];
    if (typeof next === "undefined") break;

    if (next === "n") {
      out += "\n";
      i++;
      continue;
    }
    if (next === "r") {
      out += "\r";
      i++;
      continue;
    }
    if (next === "t") {
      out += "\t";
      i++;
      continue;
    }
    if (next === "b") {
      out += "\b";
      i++;
      continue;
    }
    if (next === "f") {
      out += "\f";
      i++;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      out += next;
      i++;
      continue;
    }

    // Octal escapes: \ddd
    if (/[0-7]/.test(next)) {
      const a = inner[i + 1] ?? "";
      const b = inner[i + 2] ?? "";
      const c = inner[i + 3] ?? "";
      const oct = `${a}${/[0-7]/.test(b) ? b : ""}${/[0-7]/.test(c) ? c : ""}`;
      const code = parseInt(oct, 8);
      if (Number.isFinite(code)) {
        out += String.fromCharCode(code);
        i += oct.length;
        continue;
      }
    }

    // Unknown escape: keep the escaped char.
    out += next;
    i++;
  }
  return out;
}

function extractTextFromPdfBestEffort(pdf: Buffer): string {
  // Heuristic PDF text extraction. Works best for simple/uncompressed streams.
  const raw = pdf.toString("latin1");

  const out: string[] = [];
  const pushFrom = (s: string) => {
    const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    for (const match of s.matchAll(tj)) {
      out.push(decodePdfLiteralString(match[0].trim().replace(/\s*Tj$/, "")));
    }

    const tjArray = /\[(?:\s|\S)*?\]\s*TJ/g;
    for (const match of s.matchAll(tjArray)) {
      const body = match[0];
      const strRe = /\((?:\\.|[^\\)])*\)/g;
      const parts = Array.from(body.matchAll(strRe)).map((m) => decodePdfLiteralString(m[0]));
      if (parts.length > 0) out.push(parts.join(""));
    }
  };

  pushFrom(raw);

  // Attempt to inflate FlateDecode streams.
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  for (const match of raw.matchAll(streamRe)) {
    const streamBody = match[1];
    if (!streamBody) continue;
    const startIndex = match.index ?? 0;
    const header = raw.slice(Math.max(0, startIndex - 200), startIndex);
    if (!header.includes("FlateDecode")) continue;

    try {
      const inflated = inflateSync(Buffer.from(streamBody, "latin1")).toString("latin1");
      pushFrom(inflated);
    } catch {
      // ignore
    }
  }

  return out.join("\n").replaceAll(/\s+/g, " ").trim();
}

export function buildServer(deps: { repos: Repositories }) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  app.get("/graph", async (_req, reply) => {
    const nodes = await deps.repos.concept.listSummaries();
    const edges = await deps.repos.edge.listSummaries();
    const payload = { nodes, edges };

    const validated = parseOr400(reply, GraphResponseSchema, payload);
    if (!validated) return;

    return validated;
  });

  app.get("/concept/:id", async (req, reply) => {
    const params = parseOr400(reply, GetConceptParamsSchema, req.params);
    if (!params) return;

    const concept = await deps.repos.concept.getById(params.id);
    if (!concept) {
      sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: params.id });
      return;
    }

    const validated = parseOr400(reply, GetConceptResponseSchema, { concept });
    if (!validated) return;
    return validated;
  });

  app.post("/concept", async (req, reply) => {
    const body = parseOr400(reply, PostConceptRequestSchema, req.body);
    if (!body) return;

    if ("id" in body) {
      const existing = await deps.repos.concept.getById(body.id);
      if (!existing) {
        sendError(reply, 404, "NOT_FOUND", "Concept not found", { id: body.id });
        return;
      }

      await deps.repos.concept.update(body);
      const updated = await deps.repos.concept.getById(body.id);
      if (!updated) {
        sendError(reply, 500, "INTERNAL", "Failed to load updated concept");
        return;
      }

      const validated = parseOr400(reply, PostConceptResponseSchema, { concept: updated });
      if (!validated) return;
      return validated;
    }

    const created = await deps.repos.concept.create(body);
    const validated = parseOr400(reply, PostConceptResponseSchema, { concept: created });
    if (!validated) return;
    return validated;
  });

  app.post("/edge", async (req, reply) => {
    const body = parseOr400(reply, PostEdgeRequestSchema, req.body);
    if (!body) return;

    const from = await deps.repos.concept.getById(body.fromConceptId);
    if (!from) {
      sendError(reply, 404, "NOT_FOUND", "fromConceptId not found", {
        id: body.fromConceptId
      });
      return;
    }

    const to = await deps.repos.concept.getById(body.toConceptId);
    if (!to) {
      sendError(reply, 404, "NOT_FOUND", "toConceptId not found", { id: body.toConceptId });
      return;
    }

    try {
      const edge = await deps.repos.edge.create(body);
      const validated = parseOr400(reply, PostEdgeResponseSchema, { edge });
      if (!validated) return;
      return validated;
    } catch (err) {
      sendError(reply, 400, "EDGE_CREATE_FAILED", "Failed to create edge");
      app.log.error(err);
      return;
    }
  });

  app.post("/ingest", async (req, reply) => {
    const body = parseOr400(reply, IngestRequestSchema, req.body);
    if (!body) return;

    const contentType = body.contentType.toLowerCase();
    const filename = body.filename;
    const title = body.title ?? filename;
    const url = body.url ?? `upload://${crypto.randomUUID()}/${filename}`;

    let originalBytes: Buffer;
    let text: string;

    if (typeof body.text === "string") {
      originalBytes = Buffer.from(body.text, "utf8");
      text = body.text;
    } else {
      if (typeof body.base64 !== "string") {
        sendError(reply, 400, "VALIDATION_ERROR", "Invalid request");
        return;
      }

      originalBytes = Buffer.from(body.base64, "base64");
      if (!contentType.includes("pdf") && !filename.toLowerCase().endsWith(".pdf")) {
        sendError(reply, 400, "UNSUPPORTED_UPLOAD", "Only PDF uploads may use base64 mode");
        return;
      }
      text = extractTextFromPdfBestEffort(originalBytes);
    }

    if (!text.trim()) {
      sendError(reply, 400, "NO_TEXT", "No text content extracted");
      return;
    }

    const source = await deps.repos.source.create({ url, title });

    const dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(process.cwd(), "data");
    const sourceDir = path.join(dataDir, "sources", source.id);
    await fs.mkdir(sourceDir, { recursive: true });

    const ext = contentType.includes("pdf") || filename.toLowerCase().endsWith(".pdf")
      ? "pdf"
      : contentType.includes("markdown") || filename.toLowerCase().endsWith(".md")
        ? "md"
        : "txt";

    await fs.writeFile(path.join(sourceDir, `original.${ext}`), originalBytes);
    await fs.writeFile(
      path.join(sourceDir, "meta.json"),
      JSON.stringify({
        filename,
        contentType: body.contentType,
        url,
        title,
        byteLength: originalBytes.byteLength,
        storedAt: Date.now()
      })
    );

    const chunks = chunkText(text);
    for (const chunk of chunks) {
      await deps.repos.chunk.create({
        sourceId: source.id,
        content: chunk.content,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset
      });
    }

    const payload = { sourceId: source.id, chunkCount: chunks.length };
    const validated = parseOr400(reply, IngestResponseSchema, payload);
    if (!validated) return;
    return validated;
  });

  app.get("/search", async (req, reply) => {
    const query = parseOr400(reply, SearchQuerySchema, req.query);
    if (!query) return;

    const q = query.q.trim();
    if (!q) return { results: [], chunkResults: [] };

    const results = await deps.repos.concept.searchSummaries(q, 20);
    const chunkResults = await deps.repos.chunk.search(q, 20);
    const validated = parseOr400(reply, SearchResponseSchema, { results, chunkResults });
    if (!validated) return;
    return validated;
  });

  return app;
}
