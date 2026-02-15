import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Cytoscape's DOM/renderer isn't needed for unit tests and can be flaky under jsdom.
vi.mock("cytoscape", () => {
  function createCollection() {
    return {
      addClass: () => undefined,
      removeClass: () => undefined
    };
  }

  function createCy() {
    return {
      on: () => undefined,
      removeListener: () => undefined,
      destroy: () => undefined,
      elements: () => ({ remove: () => undefined }),
      add: () => undefined,
      layout: () => ({ run: () => undefined }),
      nodes: () => createCollection(),
      $id: () => ({
        addClass: () => undefined,
        removeClass: () => undefined,
        empty: () => true,
        connectedEdges: () => ({
          forEach: (fn: (edge: unknown) => void) => {
            void fn;
            return undefined;
          }
        })
      }),
      edges: () => ({
        ...createCollection(),
        forEach: (fn: (edge: unknown) => void) => {
          void fn;
          return undefined;
        }
      })
    };
  }

  return { default: () => createCy() };
});
