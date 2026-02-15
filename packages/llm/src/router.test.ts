import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_MINI,
  DEFAULT_MODEL_NANO,
  resolveModel
} from "./router";

describe("resolveModel", () => {
  it("defaults to nano + mini", () => {
    expect(resolveModel("nano", {})).toBe(DEFAULT_MODEL_NANO);
    expect(resolveModel("mini", {})).toBe(DEFAULT_MODEL_MINI);
  });

  it("respects env overrides", () => {
    expect(
      resolveModel("nano", { OPENAI_MODEL_NANO: "my-nano" } as NodeJS.ProcessEnv)
    ).toBe("my-nano");
    expect(
      resolveModel("mini", { OPENAI_MODEL_MINI: "my-mini" } as NodeJS.ProcessEnv)
    ).toBe("my-mini");
  });
});

