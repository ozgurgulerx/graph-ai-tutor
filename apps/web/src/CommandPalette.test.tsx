import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={() => {}} actions={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when open", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "test", label: "Test Action", onSelect: () => {} }]}
      />
    );
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();
  });

  it("shows actions in the list", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[
          { id: "a1", label: "Start training session", onSelect: () => {} },
          { id: "a2", label: "Open settings", onSelect: () => {} }
        ]}
      />
    );
    expect(screen.getByText("Start training session")).toBeInTheDocument();
    expect(screen.getByText("Open settings")).toBeInTheDocument();
  });

  it("filters actions by query", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[
          { id: "a1", label: "Start training session", onSelect: () => {} },
          { id: "a2", label: "Open settings", onSelect: () => {} }
        ]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "training" } });

    expect(screen.getByText("Start training session")).toBeInTheDocument();
    expect(screen.queryByText("Open settings")).not.toBeInTheDocument();
  });

  it("calls onSelect and onClose when an action is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        actions={[{ id: "a1", label: "Start training", onSelect }]}
      />
    );

    fireEvent.click(screen.getByText("Start training"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        actions={[{ id: "a1", label: "Test", onSelect: () => {} }]}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows empty message when no actions match", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        actions={[{ id: "a1", label: "Start training", onSelect: () => {} }]}
      />
    );

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "zzzzzzz" } });

    expect(screen.getByText("No matching actions")).toBeInTheDocument();
  });
});
