import { useCallback, useEffect, useRef } from "react";

import type { LayoutRequest, LayoutResponse } from "./workers/layout.worker";

type LayoutResult = LayoutResponse["positions"];

/**
 * Hook that runs Cytoscape fcose layout in a Web Worker.
 * Returns a function that accepts elements and a callback with computed positions.
 * Falls back to null if Workers are unavailable (e.g. tests).
 */
export function useLayoutWorker(): (
  elements: LayoutRequest,
  onResult: (positions: LayoutResult) => void
) => void {
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef<((positions: LayoutResult) => void) | null>(null);

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    const worker = new Worker(
      new URL("./workers/layout.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (evt: MessageEvent<LayoutResponse>) => {
      callbackRef.current?.(evt.data.positions);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  return useCallback(
    (elements: LayoutRequest, onResult: (positions: LayoutResult) => void) => {
      callbackRef.current = onResult;
      workerRef.current?.postMessage(elements);
    },
    []
  );
}
