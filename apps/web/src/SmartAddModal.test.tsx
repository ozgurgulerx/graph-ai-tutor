import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api/client", () => ({
  postCapture: vi.fn(async () => ({ changesetId: "changeset_1", itemsCreated: 1, sourceId: "source_1" }))
}));

import { SmartAddModal } from "./SmartAddModal";

describe("SmartAddModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits text to capture and calls onCaptured", async () => {
    const api = await import("./api/client");
    const onCaptured = vi.fn();
    const onClose = vi.fn();

    render(<SmartAddModal onCaptured={onCaptured} onClose={onClose} />);

    fireEvent.change(screen.getByTestId("smart-add-title"), {
      target: { value: "I learned about graph attention." }
    });
    fireEvent.click(screen.getByTestId("smart-add-submit"));

    await waitFor(() => expect(api.postCapture).toHaveBeenCalledOnce());
    expect(api.postCapture).toHaveBeenCalledWith({ text: "I learned about graph attention." });
    expect(onCaptured).toHaveBeenCalledWith("changeset_1");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not submit when input is blank", async () => {
    const api = await import("./api/client");
    const onCaptured = vi.fn();

    render(<SmartAddModal onCaptured={onCaptured} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("smart-add-submit"));

    await Promise.resolve();
    expect(api.postCapture).not.toHaveBeenCalled();
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
