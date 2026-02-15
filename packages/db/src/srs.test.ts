import { describe, expect, it } from "vitest";

import { sm2NextSchedule, updateMasteryScore } from "./srs";

describe("sm2NextSchedule (SM-2 style)", () => {
  it("correct: reps increments and schedules 1 day for first rep", () => {
    const now = 1_700_000_000_000;
    const next = sm2NextSchedule({ ease: 2.5, interval: 0, reps: 0 }, "correct", now);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.dueAt).toBe(now + 24 * 60 * 60 * 1000);
    expect(next.ease).toBeGreaterThan(2.5);
  });

  it("partial: counts as success (q>=3) but reduces ease", () => {
    const now = 1_700_000_000_000;
    const next = sm2NextSchedule({ ease: 2.5, interval: 0, reps: 0 }, "partial", now);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.ease).toBeLessThan(2.5);
  });

  it("wrong: resets reps and schedules 1 day", () => {
    const now = 1_700_000_000_000;
    const next = sm2NextSchedule({ ease: 2.5, interval: 6, reps: 2 }, "wrong", now);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.dueAt).toBe(now + 24 * 60 * 60 * 1000);
  });

  it("subsequent correct reps follow 1d -> 6d -> interval*ease", () => {
    const now = 1_700_000_000_000;

    const r1 = sm2NextSchedule({ ease: 2.5, interval: 0, reps: 0 }, "correct", now);
    expect(r1.interval).toBe(1);

    const r2 = sm2NextSchedule({ ease: r1.ease, interval: r1.interval, reps: r1.reps }, "correct", now);
    expect(r2.interval).toBe(6);

    const r3 = sm2NextSchedule({ ease: r2.ease, interval: r2.interval, reps: r2.reps }, "correct", now);
    expect(r3.interval).toBeGreaterThanOrEqual(6);
    expect(r3.dueAt).toBe(now + r3.interval * 24 * 60 * 60 * 1000);
  });
});

describe("updateMasteryScore", () => {
  it("moves mastery toward 1 on correct, toward 0 on wrong", () => {
    expect(updateMasteryScore(0.2, "correct")).toBeGreaterThan(0.2);
    expect(updateMasteryScore(0.8, "wrong")).toBeLessThan(0.8);
  });
});

