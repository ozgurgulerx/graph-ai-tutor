import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom doesn't provide ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Cytoscape's DOM/renderer isn't needed for unit tests and can be flaky under jsdom.
vi.mock("cytoscape", () => {
  function createCollection(): Record<string, unknown> {
    const col: Record<string, unknown> = {
      addClass: () => col,
      removeClass: () => col,
      filter: () => createCollection(),
      sort: () => createCollection(),
      not: () => createCollection(),
      forEach: () => undefined,
      remove: () => undefined,
      length: 0
    };
    return col;
  }

  function createCy(): Record<string, unknown> {
    const cy: Record<string, unknown> = {
      on: () => undefined,
      removeListener: () => undefined,
      destroy: () => undefined,
      elements: () => createCollection(),
      add: () => undefined,
      layout: () => ({ run: () => undefined }),
      nodes: () => createCollection(),
      edges: () => createCollection(),
      zoom: () => 1,
      resize: () => undefined,
      batch: (fn: () => void) => fn(),
      animate: () => undefined,
      $id: () => ({
        ...createCollection(),
        empty: () => true,
        connectedEdges: () => createCollection()
      })
    };
    return cy;
  }

  return { default: () => createCy() };
});
