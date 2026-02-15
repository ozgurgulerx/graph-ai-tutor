import { describe, expect, it } from "vitest";

import { loadEvalFixtures, validateEvalFixture } from "./harness";

const fixtures = loadEvalFixtures();

describe("Evals-lite (fixture validators)", () => {
  it("loads at least one eval fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(`validates fixture: ${fixture.id}`, () => {
      expect(() => validateEvalFixture(fixture)).not.toThrow();
    });
  }
});

