import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.endsWith("/api/graph")) {
          return new Response(
            JSON.stringify({
              nodes: [{ id: "concept_kv_cache", title: "KV cache", module: "inference" }],
              edges: []
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
});
