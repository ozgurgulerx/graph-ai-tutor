import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UI_FLAGS,
  UI_FLAGS_STORAGE_KEY,
  useUiFlags
} from "./uiFlags";

describe("useUiFlags", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when storage is empty", () => {
    const { result } = renderHook(() => useUiFlags());
    expect(result.current.flags).toEqual(DEFAULT_UI_FLAGS);
  });

  it("loads persisted flags from localStorage", () => {
    window.localStorage.setItem(
      UI_FLAGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_UI_FLAGS,
        designV2Enabled: true,
        tutorDrawerEnabled: true
      })
    );

    const { result } = renderHook(() => useUiFlags());
    expect(result.current.flags.designV2Enabled).toBe(true);
    expect(result.current.flags.tutorDrawerEnabled).toBe(true);
    expect(result.current.flags.rightPaneV2Enabled).toBe(false);
  });

  it("falls back to defaults when storage JSON is invalid", () => {
    window.localStorage.setItem(UI_FLAGS_STORAGE_KEY, "{not-json");
    const { result } = renderHook(() => useUiFlags());
    expect(result.current.flags).toEqual(DEFAULT_UI_FLAGS);
  });

  it("setFlag updates state and persists", () => {
    const { result } = renderHook(() => useUiFlags());

    act(() => {
      result.current.setFlag("rightPaneV2Enabled", true);
    });

    expect(result.current.flags.rightPaneV2Enabled).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem(UI_FLAGS_STORAGE_KEY) ?? "{}");
    expect(saved.rightPaneV2Enabled).toBe(true);
  });

  it("resetFlags restores defaults and persists", () => {
    const { result } = renderHook(() => useUiFlags());

    act(() => {
      result.current.setFlag("designV2Enabled", true);
      result.current.setFlag("autoLensOnSelectEnabled", true);
    });

    act(() => {
      result.current.resetFlags();
    });

    expect(result.current.flags).toEqual(DEFAULT_UI_FLAGS);
    const saved = JSON.parse(window.localStorage.getItem(UI_FLAGS_STORAGE_KEY) ?? "{}");
    expect(saved).toEqual(DEFAULT_UI_FLAGS);
  });
});
