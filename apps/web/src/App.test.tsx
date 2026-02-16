import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { describe, expect, it } from "vitest";

import App from "./App";

async function selectKvConceptFromTree() {
  const groupLabel = await screen.findByText(/inference \(1\)/i);
  const disclosure = groupLabel.closest(".treeRow")!.querySelector(".treeDisclosure")!;
  const kvButton = screen.queryByRole("button", { name: /kv cache/i });
  if (!kvButton) {
    fireEvent.click(disclosure);
  }
  fireEvent.click(await screen.findByRole("button", { name: /kv cache/i }));
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = (init?.method ?? "GET").toUpperCase();
        const kvId = "genai.systems_inference.kvcache.kv_cache";
        if (url.endsWith("/api/graph")) {
          return new Response(
            JSON.stringify({
              nodes: [{ id: kvId, title: "KV cache", module: "inference" }],
              edges: []
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith("/api/changesets") && method === "GET") {
          return new Response(
            JSON.stringify({
              changesets: [
                { id: "changeset_draft_1", sourceId: null, status: "draft", createdAt: 0, appliedAt: null },
                { id: "changeset_applied_1", sourceId: null, status: "applied", createdAt: 0, appliedAt: 1 }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.includes("/api/review/due") && method === "GET") {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "review_item_1",
                  conceptId: kvId,
                  prompt: "What does KV cache store?",
                  type: "CLOZE",
                  answer: { blanks: ["key/value tensors"] },
                  rubric: { explanation: "Should mention cached key/value tensors." },
                  status: "active",
                  dueAt: 0,
                  ease: 2.5,
                  interval: 1,
                  reps: 1,
                  createdAt: 0,
                  updatedAt: 1
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith(`/api/concept/${kvId}`) && method === "GET") {
          return new Response(
            JSON.stringify({
              concept: {
                id: kvId,
                title: "KV cache",
                l0: null,
                l1: [],
                l2: [],
                module: "inference",
                noteSourceId: null,
                createdAt: 0,
                updatedAt: 1
              }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith(`/api/concept/${kvId}/sources`) && method === "GET") {
          return new Response(JSON.stringify({ sources: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/draft-revisions`) && method === "GET") {
          return new Response(JSON.stringify({ revisions: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/merges`) && method === "GET") {
          return new Response(JSON.stringify({ merges: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/quizzes`) && method === "GET") {
          return new Response(JSON.stringify({ quizzes: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/quizzes/generate`) && method === "POST") {
          return new Response(JSON.stringify({ quizzes: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/note`) && method === "GET") {
          return new Response(JSON.stringify({ source: null, content: "" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/backlinks`) && method === "GET") {
          return new Response(JSON.stringify({ concepts: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.endsWith(`/api/concept/${kvId}/source`) && method === "POST") {
          return new Response(
            JSON.stringify({
              source: {
                id: "source_1",
                url: "https://example.com/docs",
                title: "Example docs",
                createdAt: 0
              }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith("/api/changeset/changeset_draft_1") && method === "GET") {
          return new Response(
            JSON.stringify({
              changeset: { id: "changeset_draft_1", sourceId: null, status: "draft", createdAt: 0, appliedAt: null },
              items: [],
              evidenceChunks: []
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /graph ai tutor/i })
    ).toBeInTheDocument();
  });

  it("renders at least one node label", async () => {
    render(<App />);
    const groupLabel = await screen.findByText(/inference \(1\)/i);
    const disclosure = groupLabel.closest(".treeRow")!.querySelector(".treeDisclosure")!;
    fireEvent.click(disclosure);
    expect(await screen.findByRole("button", { name: /kv cache/i })).toBeVisible();
  });

  it("attaches a source url to a concept and shows it in the UI", async () => {
    render(<App />);

    await selectKvConceptFromTree();
    expect(await screen.findByTestId("concept-title")).toHaveTextContent(/kv cache/i);

    // Navigate to Sources tab (sub-tabs feature)
    fireEvent.click(await screen.findByTestId("tab-sources"));

    fireEvent.change(screen.getByLabelText(/source url/i), {
      target: { value: "https://example.com/docs" }
    });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Example docs" }
    });

    fireEvent.click(screen.getByRole("button", { name: /attach source/i }));

    expect(await screen.findByRole("link", { name: /example docs/i })).toBeVisible();
  });

  it("shows V2 debug flags, allows toggling, and can reset defaults", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^debug$/i }));
    expect(await screen.findByTestId("debug-v2-flags")).toBeVisible();

    const designFlag = screen.getByLabelText("designV2Enabled") as HTMLInputElement;
    const autoLensFlag = screen.getByLabelText("autoLensOnSelectEnabled") as HTMLInputElement;

    expect(designFlag.checked).toBe(true);
    fireEvent.click(autoLensFlag);
    expect(autoLensFlag.checked).toBe(true);

    let persisted = JSON.parse(window.localStorage.getItem("graph-ai-tutor.uiFlags.v1") ?? "{}");
    expect(persisted.autoLensOnSelectEnabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    expect((screen.getByLabelText("designV2Enabled") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("rightPaneV2Enabled") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("conceptInspectorV2Enabled") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("tutorDrawerEnabled") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("autoLensOnSelectEnabled") as HTMLInputElement).checked).toBe(false);

    persisted = JSON.parse(window.localStorage.getItem("graph-ai-tutor.uiFlags.v1") ?? "{}");
    expect(persisted).toEqual({
      designV2Enabled: false,
      rightPaneV2Enabled: false,
      conceptInspectorV2Enabled: false,
      tutorDrawerEnabled: false,
      autoLensOnSelectEnabled: false
    });
  });

  it("shows right pane V2 preview only when designV2 + rightPaneV2 are enabled", async () => {
    render(<App />);
    expect(screen.queryByTestId("right-pane-v2-preview")).not.toBeInTheDocument();

    cleanup();

    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: true,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);
    expect(await screen.findByTestId("right-pane-v2-preview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Inspector" })).toBeVisible();
  });

  it("keeps legacy Tutor tab when tutor drawer gate is off", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /^Tutor$/i })).toBeVisible();
  });

  it("renders Inspector V2 sections and keeps Concept Workspace actions reachable", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);

    await selectKvConceptFromTree();

    expect(await screen.findByTestId("inspector-section-overview")).toBeVisible();
    expect(screen.getByTestId("inspector-section-relationships")).toBeVisible();
    expect(screen.getByTestId("inspector-section-notes")).toBeVisible();
    expect(screen.getByTestId("inspector-section-quizzes")).toBeVisible();
    expect(screen.getByTestId("inspector-section-sources")).toBeVisible();
    expect(screen.getByTestId("inspector-section-advanced")).toBeVisible();
    expect(screen.getByRole("button", { name: /\+ note/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /generate quiz/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Edit$/ })).toBeVisible();
    expect(screen.queryByTestId("right-pane-v2-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /generate quiz/i }));
    expect(
      within(screen.getByTestId("inspector-section-quizzes")).getByRole("button", {
        name: /^Generate$/i
      })
    ).toBeVisible();
  });

  it("uses Tutor drawer in V2 mode and opens it from Ask Tutor", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: true,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);
    await selectKvConceptFromTree();

    expect(screen.queryByRole("button", { name: /^Tutor$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Ask Tutor$/i }));

    expect(screen.getByTestId("tutor-drawer-panel")).toBeVisible();
    expect(screen.getByLabelText(/question/i)).toHaveValue(
      "Explain KV cache with prerequisites and examples."
    );
  });

  it("auto dependency view applies on concept select when designV2 + auto are enabled", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: true
      })
    );

    render(<App />);
    await selectKvConceptFromTree();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByLabelText(/view mode/i)).toHaveValue("lens");
    expect(screen.getByLabelText(/edge visibility/i)).toHaveValue("prereq_only");
  });

  it("keeps existing behavior when auto lens flag is off", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);
    await selectKvConceptFromTree();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByLabelText(/view mode/i)).toHaveValue("classic");
    expect(screen.getByLabelText(/edge visibility/i)).toHaveValue("filtered");
  });

  it("manual view override suppresses auto until auto toggle is re-armed", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: true
      })
    );

    render(<App />);
    await selectKvConceptFromTree();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByLabelText(/view mode/i)).toHaveValue("lens");
    expect(screen.getByLabelText(/edge visibility/i)).toHaveValue("prereq_only");

    fireEvent.change(screen.getByLabelText(/view mode/i), { target: { value: "classic" } });
    fireEvent.change(screen.getByLabelText(/edge visibility/i), { target: { value: "all" } });
    expect(screen.getByTestId("auto-view-override-hint")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await selectKvConceptFromTree();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByLabelText(/view mode/i)).toHaveValue("classic");
    expect(screen.getByLabelText(/edge visibility/i)).toHaveValue("all");

    const autoToggle = screen.getByLabelText(/auto dependency view on select/i);
    fireEvent.click(autoToggle);
    fireEvent.click(autoToggle);

    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await selectKvConceptFromTree();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByLabelText(/view mode/i)).toHaveValue("lens");
    expect(screen.getByLabelText(/edge visibility/i)).toHaveValue("prereq_only");
  });

  it("uses top-bar counters + workbench modal for Inbox/Review in V2 mode", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: false,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);

    const tabs = screen.getByRole("tablist", { name: /right panel tabs/i });
    expect(within(tabs).queryByRole("button", { name: /^Inbox$/i })).not.toBeInTheDocument();
    expect(within(tabs).queryByRole("button", { name: /^Review$/i })).not.toBeInTheDocument();

    const inboxButton = await screen.findByTestId("topbar-inbox-count");
    const reviewButton = await screen.findByTestId("topbar-review-count");
    expect(inboxButton).toHaveTextContent("1");
    expect(reviewButton).toHaveTextContent("1");

    fireEvent.click(inboxButton);
    expect(await screen.findByTestId("workbench-modal")).toBeVisible();
    expect(await screen.findByTestId("inbox-panel")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByTestId("workbench-modal")).not.toBeInTheDocument();

    fireEvent.click(reviewButton);
    expect(await screen.findByTestId("workbench-modal")).toBeVisible();
    expect(await screen.findByTestId("review-panel")).toBeVisible();
  });

  it("command palette opens workbench and selection-required actions no-op with snackbar", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(await screen.findByText("Open Inbox"));
    expect(await screen.findByTestId("workbench-modal")).toBeVisible();
    expect(await screen.findByTestId("inbox-panel")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(await screen.findByText("New Note"));
    expect(await screen.findByRole("status")).toHaveTextContent("Select a concept first");
  });

  it("opens and closes shortcut help from button and command action", async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("open-shortcuts-help"));
    expect(await screen.findByTestId("shortcuts-help-overlay")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shortcuts-help-overlay"));
    expect(screen.queryByTestId("shortcuts-help-overlay")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(await screen.findByText("Show shortcuts"));
    expect(await screen.findByTestId("shortcuts-help-overlay")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("shortcuts-help-overlay")).not.toBeInTheDocument();
  });

  it("global shortcuts drive concept actions, pane toggles, and clear selection", async () => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );

    render(<App />);
    await selectKvConceptFromTree();

    expect(await screen.findByTestId("concept-title")).toHaveTextContent(/kv cache/i);

    fireEvent.keyDown(window, { key: "n" });
    expect(await screen.findByTestId("concept-notes-v2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "q" });
    expect(await screen.findByRole("button", { name: /^Generate$/i })).toBeVisible();

    const shell = document.querySelector(".shell") as HTMLElement;

    fireEvent.keyDown(window, { key: "[" });
    expect(shell.style.gridTemplateColumns.startsWith("0px")).toBe(true);

    fireEvent.keyDown(window, { key: "[" });
    expect(shell.style.gridTemplateColumns.startsWith("0px")).toBe(false);

    fireEvent.keyDown(window, { key: "]" });
    expect(shell.style.gridTemplateColumns.endsWith("0px")).toBe(true);
    const collapsedRightColumns = shell.style.gridTemplateColumns;

    fireEvent.keyDown(window, { key: "]" });
    expect(shell.style.gridTemplateColumns).not.toBe(collapsedRightColumns);

    fireEvent.keyDown(window, { key: "?" });
    expect(await screen.findByTestId("shortcuts-help-overlay")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("shortcuts-help-overlay")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText(/Select a concept to view details/i)).toBeVisible();
  });
});
