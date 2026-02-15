import { describe, expect, it } from "vitest";

import { buildServer } from "./server";

describe("GET /health", () => {
  it("returns ok: true", async () => {
    const app = buildServer();

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });
});

