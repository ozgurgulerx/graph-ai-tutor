import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InteractionMode } from "./GraphNavToolbar";
import { GraphNavToolbar } from "./GraphNavToolbar";

const noop = () => {};

function renderToolbar(overrides: Partial<{
  cy: unknown;
  interactionMode: InteractionMode;
  onInteractionModeChange: (mode: InteractionMode) => void;
}> = {}) {
  return render(
    <GraphNavToolbar
      cy={(overrides.cy ?? null) as never}
      interactionMode={overrides.interactionMode ?? "pointer"}
      onInteractionModeChange={overrides.onInteractionModeChange ?? noop}
    />
  );
}

describe("GraphNavToolbar", () => {
  it("renders all 5 action buttons", () => {
    renderToolbar();

    expect(screen.getByTestId("nav-pointer")).toBeInTheDocument();
    expect(screen.getByTestId("nav-pan")).toBeInTheDocument();
    expect(screen.getByTestId("nav-zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("nav-zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("nav-fit")).toBeInTheDocument();
  });

  it("pointer button has active class by default", () => {
    renderToolbar();

    expect(screen.getByTestId("nav-pointer").className).toContain("graphNavToolbar__btn--active");
    expect(screen.getByTestId("nav-pan").className).not.toContain("graphNavToolbar__btn--active");
  });

  it("pan button has active class when in pan mode", () => {
    renderToolbar({ interactionMode: "pan" });

    expect(screen.getByTestId("nav-pan").className).toContain("graphNavToolbar__btn--active");
    expect(screen.getByTestId("nav-pointer").className).not.toContain("graphNavToolbar__btn--active");
  });

  it("clicking pan calls onInteractionModeChange with 'pan'", () => {
    const onChange = vi.fn();
    renderToolbar({ onInteractionModeChange: onChange });

    fireEvent.click(screen.getByTestId("nav-pan"));
    expect(onChange).toHaveBeenCalledWith("pan");
  });

  it("clicking pointer calls onInteractionModeChange with 'pointer'", () => {
    const onChange = vi.fn();
    renderToolbar({ interactionMode: "pan", onInteractionModeChange: onChange });

    fireEvent.click(screen.getByTestId("nav-pointer"));
    expect(onChange).toHaveBeenCalledWith("pointer");
  });

  it("keyboard H triggers pan mode", () => {
    const onChange = vi.fn();
    renderToolbar({ onInteractionModeChange: onChange });

    fireEvent.keyDown(document, { key: "H" });
    expect(onChange).toHaveBeenCalledWith("pan");
  });

  it("keyboard V triggers pointer mode", () => {
    const onChange = vi.fn();
    renderToolbar({ interactionMode: "pan", onInteractionModeChange: onChange });

    fireEvent.keyDown(document, { key: "V" });
    expect(onChange).toHaveBeenCalledWith("pointer");
  });

  it("keyboard shortcuts are ignored when input is focused", () => {
    const onChange = vi.fn();
    renderToolbar({ onInteractionModeChange: onChange });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "H" });
    expect(onChange).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
