import { useCallback, useEffect, useState } from "react";

export type UiFlags = {
  designV2Enabled: boolean;
  rightPaneV2Enabled: boolean;
  conceptInspectorV2Enabled: boolean;
  tutorDrawerEnabled: boolean;
  autoLensOnSelectEnabled: boolean;
};

export const DEFAULT_UI_FLAGS: UiFlags = {
  designV2Enabled: false,
  rightPaneV2Enabled: false,
  conceptInspectorV2Enabled: false,
  tutorDrawerEnabled: false,
  autoLensOnSelectEnabled: false
};

export const UI_FLAGS_STORAGE_KEY = "graph-ai-tutor.uiFlags.v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeFlags(value: unknown): UiFlags {
  if (!isObject(value)) return DEFAULT_UI_FLAGS;

  const next: UiFlags = { ...DEFAULT_UI_FLAGS };
  for (const key of Object.keys(DEFAULT_UI_FLAGS) as Array<keyof UiFlags>) {
    const raw = value[key];
    if (typeof raw === "boolean") {
      next[key] = raw;
    }
  }
  return next;
}

function loadFlags(): UiFlags {
  if (!isBrowser()) return DEFAULT_UI_FLAGS;
  try {
    const raw = window.localStorage.getItem(UI_FLAGS_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_FLAGS;
    return normalizeFlags(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_FLAGS;
  }
}

function saveFlags(flags: UiFlags): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(UI_FLAGS_STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Best effort only; keep UI responsive even if storage is unavailable.
  }
}

export function useUiFlags(): {
  flags: UiFlags;
  setFlag: <K extends keyof UiFlags>(key: K, value: UiFlags[K]) => void;
  resetFlags: () => void;
} {
  const [flags, setFlags] = useState<UiFlags>(() => loadFlags());

  const setFlag = useCallback(<K extends keyof UiFlags>(key: K, value: UiFlags[K]) => {
    setFlags((prev) => {
      if (prev[key] === value) return prev;
      const next = { ...prev, [key]: value };
      saveFlags(next);
      return next;
    });
  }, []);

  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_UI_FLAGS);
    saveFlags(DEFAULT_UI_FLAGS);
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== UI_FLAGS_STORAGE_KEY) return;
      setFlags(loadFlags());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { flags, setFlag, resetFlags };
}
