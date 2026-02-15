import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdgeTypePicker } from "./EdgeTypePicker";

describe("EdgeTypePicker", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <EdgeTypePicker open={false} onSelect={() => {}} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when open", () => {
    render(
      <EdgeTypePicker open={true} onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.getByTestId("edge-type-picker")).toBeInTheDocument();
    expect(screen.getByText("Select edge type")).toBeInTheDocument();
  });

  it("shows category groups", () => {
    render(
      <EdgeTypePicker open={true} onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText("Structural")).toBeInTheDocument();
    expect(screen.getByText("Dependency")).toBeInTheDocument();
    expect(screen.getByText("Comparative")).toBeInTheDocument();
  });

  it("expands a category and shows types on click", () => {
    render(
      <EdgeTypePicker open={true} onSelect={() => {}} onClose={() => {}} />
    );

    const structuralBtn = screen.getByTestId("edge-type-group-structural");
    fireEvent.click(structuralBtn);

    expect(screen.getByText("PREREQUISITE_OF")).toBeInTheDocument();
    expect(screen.getByText("IS_A")).toBeInTheDocument();
  });

  it("calls onSelect when a type is clicked", () => {
    const onSelect = vi.fn();
    render(
      <EdgeTypePicker open={true} onSelect={onSelect} onClose={() => {}} />
    );

    fireEvent.click(screen.getByTestId("edge-type-group-structural"));
    fireEvent.click(screen.getByText("PREREQUISITE_OF"));

    expect(onSelect).toHaveBeenCalledWith("PREREQUISITE_OF");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <EdgeTypePicker open={true} onSelect={() => {}} onClose={onClose} />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(
      <EdgeTypePicker open={true} onSelect={() => {}} onClose={onClose} />
    );

    fireEvent.click(screen.getByTestId("edge-type-picker"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
