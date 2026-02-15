import {
  ApiErrorSchema,
  GetConceptResponseSchema,
  GraphResponseSchema
} from "../schemas/api-v1";
import type { GetConceptResponse, GraphResponse } from "../schemas/api-v1";

export type ApiClient = {
  getGraph: () => Promise<GraphResponse>;
  getConcept: (id: string) => Promise<GetConceptResponse>;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function throwApiError(res: Response): Promise<never> {
  const body = await parseJson(res);
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new Error(`${parsed.data.error.code}: ${parsed.data.error.message}`);
  }
  throw new Error(`HTTP ${res.status}`);
}

export function createApiClient(options: { baseUrl?: string } = {}): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "/api");

  return {
    async getGraph() {
      const res = await fetch(`${baseUrl}/graph`);
      if (!res.ok) return throwApiError(res);
      const body = await parseJson(res);
      return GraphResponseSchema.parse(body);
    },
    async getConcept(id: string) {
      const res = await fetch(`${baseUrl}/concept/${encodeURIComponent(id)}`);
      if (!res.ok) return throwApiError(res);
      const body = await parseJson(res);
      return GetConceptResponseSchema.parse(body);
    }
  };
}

export const defaultApiClient = createApiClient();

export const getGraph = defaultApiClient.getGraph;
export const getConcept = defaultApiClient.getConcept;

