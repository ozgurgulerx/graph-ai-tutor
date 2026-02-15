import Fastify from "fastify";
import type { FastifyReply } from "fastify";

import type { Repositories } from "@graph-ai-tutor/db";
import {
  GetConceptParamsSchema,
  GetConceptResponseSchema,
  GraphResponseSchema,
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

  app.get("/search", async (req, reply) => {
    const query = parseOr400(reply, SearchQuerySchema, req.query);
    if (!query) return;

    const q = query.q.trim();
    if (!q) return { results: [] };

    const results = await deps.repos.concept.searchSummaries(q, 20);
    const validated = parseOr400(reply, SearchResponseSchema, { results });
    if (!validated) return;
    return validated;
  });

  return app;
}
