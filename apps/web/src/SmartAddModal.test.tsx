import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api/client", () => ({
  postSmartAddResolve: vi.fn(async () => ({
    kind: "Concept",
    l0: "Overview of RAG.",
    l1: ["Combines retrieval with generation"],
    module: null,
    edges: [
      {
        existingConceptId: "c1",
        existingConceptTitle: "Transformer",
        type: "PREREQUISITE_OF",
        direction: "from",
        confidence: 0.9,
        evidence: "RAG builds on Transformer"
      }
    ]
  })),
  postSmartAddConfirm: vi.fn(async () => ({
    concept: { id: "new_1", title: "RAG", kind: "Concept", l0: "Overview of RAG.", l1: [], l2: [], module: null, noteSourceId: null, context: null, masteryScore: 0, createdAt: 0, updatedAt: 0 },
    edgesCreated: 1
  }))
}));

import { SmartAddModal } from "./SmartAddModal";

describe("SmartAddModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves placement and confirms concept creation", async () => {
    const api = await import("./api/client");
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(<SmartAddModal onCreated={onCreated} onClose={onClose} />);

    fireEvent.change(screen.getByTestId("smart-add-title"), {
      target: { value: "RAG" }
    });
    fireEvent.click(screen.getByTestId("smart-add-resolve"));

    await waitFor(() => expect(api.postSmartAddResolve).toHaveBeenCalledOnce());
    expect(api.postSmartAddResolve).toHaveBeenCalledWith({ title: "RAG" });

    // Preview should now be visible
    await waitFor(() => expect(screen.getByTestId("smart-add-preview")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("smart-add-confirm"));

    await waitFor(() => expect(api.postSmartAddConfirm).toHaveBeenCalledOnce());
    expect(api.postSmartAddConfirm).toHaveBeenCalledWith({
      title: "RAG",
      kind: "Concept",
      l0: "Overview of RAG.",
      l1: ["Combines retrieval with generation"],
      module: null,
      edges: [
        {
          existingConceptId: "c1",
          type: "PREREQUISITE_OF",
          direction: "from"
        }
      ]
    });
    expect(onCreated).toHaveBeenCalledWith("new_1");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not resolve when input is blank", async () => {
    const api = await import("./api/client");
    const onCreated = vi.fn();

    render(<SmartAddModal onCreated={onCreated} onClose={vi.fn()} />);

    // The resolve button should be disabled when empty
    const resolveBtn = screen.getByTestId("smart-add-resolve");
    expect(resolveBtn).toBeDisabled();

    await Promise.resolve();
    expect(api.postSmartAddResolve).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
