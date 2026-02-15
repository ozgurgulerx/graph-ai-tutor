import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = (init?.method ?? "GET").toUpperCase();
        const kvId = "genai.systems_inference.kvcache.kv_cache";
        if (url.endsWith("/api/graph")) {
          return new Response(
            JSON.stringify({
              nodes: [{ id: kvId, title: "KV cache", module: "inference" }],
              edges: []
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith(`/api/concept/${kvId}`) && method === "GET") {
          return new Response(
            JSON.stringify({
              concept: {
                id: kvId,
                title: "KV cache",
                l0: null,
                l1: [],
                l2: [],
                module: "inference",
                createdAt: 0,
                updatedAt: 1
              }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith(`/api/concept/${kvId}/sources`) && method === "GET") {
          return new Response(JSON.stringify({ sources: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/draft-revisions`) && method === "GET") {
          return new Response(JSON.stringify({ revisions: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/source`) && method === "POST") {
          return new Response(
            JSON.stringify({
              source: {
                id: "source_1",
                url: "https://example.com/docs",
                title: "Example docs",
                createdAt: 0
              }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /graph ai tutor/i })
    ).toBeInTheDocument();
  });

  it("renders at least one node label", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /kv cache/i })).toBeVisible();
  });

  it("attaches a source url to a concept and shows it in the UI", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /kv cache/i }));
    expect(await screen.findByTestId("concept-title")).toHaveTextContent(/kv cache/i);

    fireEvent.change(screen.getByLabelText(/source url/i), {
      target: { value: "https://example.com/docs" }
    });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Example docs" }
    });

    fireEvent.click(screen.getByRole("button", { name: /attach source/i }));

    expect(await screen.findByRole("link", { name: /example docs/i })).toBeVisible();
  });
});
