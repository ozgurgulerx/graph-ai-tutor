import { describe, expect, it } from "vitest";

import { HealthResponseSchema } from "./health";

describe("HealthResponseSchema", () => {
  it("parses ok: true", () => {
    expect(HealthResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });
});

