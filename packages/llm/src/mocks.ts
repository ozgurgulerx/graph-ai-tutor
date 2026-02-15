import type { OpenAIResponsesClient, OpenAIResponsesResponse } from "./responses";

export function createMockResponsesClient(
  impl: (
    req: unknown
  ) => Promise<OpenAIResponsesResponse> | OpenAIResponsesResponse
): OpenAIResponsesClient {
  return {
    async create(req) {
      return await impl(req);
    }
  };
}

