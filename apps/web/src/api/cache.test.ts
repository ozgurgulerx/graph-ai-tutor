import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestCache } from "./cache";

describe("RequestCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const cache = new RequestCache();
    cache.set("k1", { value: 42 });
    expect(cache.get("k1")).toEqual({ value: 42 });
  });

  it("returns undefined for missing keys", () => {
    const cache = new RequestCache();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    const cache = new RequestCache(1000);
    cache.set("k1", "hello");
    expect(cache.get("k1")).toBe("hello");

    vi.advanceTimersByTime(999);
    expect(cache.get("k1")).toBe("hello");

    vi.advanceTimersByTime(1);
    expect(cache.get("k1")).toBeUndefined();
  });

  it("invalidate removes a specific key", () => {
    const cache = new RequestCache();
    cache.set("k1", "a");
    cache.set("k2", "b");
    cache.invalidate("k1");
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBe("b");
  });

  it("clear removes all keys", () => {
    const cache = new RequestCache();
    cache.set("k1", "a");
    cache.set("k2", "b");
    cache.clear();
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBeUndefined();
  });
});
