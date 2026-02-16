import { describe, it, expect } from "vitest";
import { LruCache } from "./LruCache";

describe("LruCache", () => {
  it("returns undefined for missing keys", () => {
    const cache = new LruCache<number>(3);
    expect(cache.get("x")).toBeUndefined();
  });

  it("stores and retrieves values", () => {
    const cache = new LruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(2);
  });

  it("evicts the least recently used entry when over capacity", () => {
    const cache = new LruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // should evict "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(3);
  });

  it("moves accessed entries to the end (most recently used)", () => {
    const cache = new LruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    // Access "a" to move it to the end
    cache.get("a");
    cache.set("d", 4); // should evict "b" (oldest after "a" was accessed)
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("overwrites existing keys and moves them to the end", () => {
    const cache = new LruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("a", 10); // overwrite "a"
    cache.set("d", 4); // should evict "b"
    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(3);
  });

  it("clears all entries", () => {
    const cache = new LruCache<number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });
});
