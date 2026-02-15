import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Source } from "@graph-ai-tutor/shared";

import { getSourceContent, postSourceContent } from "./api/client";

type CodeModalState = { lang: string | null; code: string } | null;

function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as HTMLElement).isContentEditable;
}

function titleFromSource(source: Source | null): string {
  return source?.title ?? "Source";
}

function parseBlocks(content: string): Array<
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; alt: string; url: string }
  | { type: "code"; lang: string | null; code: string }
> {
  const blocks: Array<
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "image"; alt: string; url: string }
    | { type: "code"; lang: string | null; code: string }
  > = [];

  const lines = content.split(/\r?\n/);
  let i = 0;
  let paragraph: string[] = [];

  function flushParagraph() {
    const text = paragraph.join("\n").trim();
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", text });
  }

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      const lang = fence[1]?.trim() ? fence[1].trim() : null;
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      // Skip closing fence if present.
      if (i < lines.length && (lines[i] ?? "").startsWith("```")) i += 1;
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1]?.length ?? 1,
        text: heading[2]?.trim() ?? ""
      });
      i += 1;
      continue;
    }

    const img = line.trim().match(/^!\[([^\]]*)\][(]([^)]+)[)]\s*$/);
    if (img) {
      flushParagraph();
      blocks.push({ type: "image", alt: img[1] ?? "", url: img[2] ?? "" });
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      i += 1;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  return blocks;
}

function Modal(props: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="modalCard">
        <div className="modalHeader">
          <div className="modalTitle">{props.title}</div>
          <button type="button" className="ghostButton" onClick={props.onClose}>
            Close
          </button>
        </div>
        <div className="modalBody">{props.children}</div>
      </div>
    </div>
  );
}

export function SourcePanel(props: {
  sourceId: string | null;
  onSaved?: () => void;
}) {
  const sourceId = props.sourceId;
  const onSaved = props.onSaved;

  const [source, setSource] = useState<Source | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);

  const blocks = useMemo(() => parseBlocks(content), [content]);

  useEffect(() => {
    if (!sourceId) {
      setSource(null);
      setContent("");
      setDraft("");
      setLastSaved("");
      setLoading(false);
      setError(null);
      setEditing(false);
      setSaveStatus("idle");
      setSaveError(null);
      setSavedAt(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveError(null);
    setSaveStatus("idle");

    getSourceContent(sourceId)
      .then((res) => {
        if (cancelled) return;
        setSource(res.source);
        setContent(res.content);
        setDraft(res.content);
        setLastSaved(res.content);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load source");
        setSource(null);
        setContent("");
        setDraft("");
        setLastSaved("");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  // Toggle edit mode with "E" when not typing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sourceId) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== "e") return;
      if (isTypingElement(document.activeElement)) return;
      e.preventDefault();
      setEditing((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sourceId]);

  // Close modals with Escape.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (imageModalUrl) setImageModalUrl(null);
      if (codeModal) setCodeModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageModalUrl, codeModal]);

  // Autosave debounced.
  useEffect(() => {
    if (!sourceId) return;
    if (!editing) return;
    if (loading) return;
    if (draft === lastSaved) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSaveStatus("saving");
      setSaveError(null);
      postSourceContent(sourceId, { content: draft })
        .then((res) => {
          if (cancelled) return;
          setSource(res.source);
          setContent(draft);
          setLastSaved(draft);
          setSaveStatus("saved");
          setSavedAt(Date.now());
          onSaved?.();
        })
        .catch((err) => {
          if (cancelled) return;
          setSaveStatus("error");
          setSaveError(err instanceof Error ? err.message : "Failed to save");
        });
    }, 750);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [sourceId, editing, loading, draft, lastSaved, onSaved]);

  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editing) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }
    if (!editorHostRef.current) return;
    if (!sourceId) return;

    const state = EditorState.create({
      doc: draft,
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        keymap.of([
          {
            key: "Escape",
            run: () => {
              setEditing(false);
              return true;
            }
          }
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          setDraft(update.state.doc.toString());
        })
      ]
    });

    const view = new EditorView({ state, parent: editorHostRef.current });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, sourceId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === draft) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: draft } });
  }, [draft]);

  return (
    <div className="sourcePanel" data-testid="source-panel">
      <div className="sourceHeader">
        <div>
          <h3 className="paneTitle" data-testid="source-title">
            {titleFromSource(source)}
          </h3>
          {source ? <div className="mutedText">{source.url}</div> : null}
        </div>

        <div className="buttonRow">
          <button
            type="button"
            className={!editing ? "primaryButton" : "secondaryButton"}
            onClick={() => setEditing((v) => !v)}
            disabled={!sourceId || loading}
          >
            {!editing ? "Edit (E)" : "Done"}
          </button>
        </div>
      </div>

      {!sourceId ? (
        <p className="mutedText">Select a local source to view and edit.</p>
      ) : loading ? (
        <p className="mutedText">Loading source...</p>
      ) : error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : (
        <>
          {editing ? (
            <>
              <div className="saveStatusRow">
                <span className="mutedText">
                  {saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "saved"
                      ? `Saved${savedAt ? ` • ${new Date(savedAt).toLocaleTimeString()}` : ""}`
                      : saveStatus === "error"
                        ? "Save failed"
                        : draft === lastSaved
                          ? "No changes"
                          : "Editing..."}
                </span>
              </div>

              {saveError ? (
                <p role="alert" className="errorText">
                  {saveError}
                </p>
              ) : null}

              <div className="codeMirrorHost" ref={editorHostRef} />
            </>
          ) : (
            <div className="sourceRead">
              {blocks.length === 0 ? <p className="mutedText">(Empty)</p> : null}
              {blocks.map((b, idx) =>
                b.type === "heading" ? (
                  b.level === 1 ? (
                    <h2 key={idx}>{b.text}</h2>
                  ) : (
                    <h3 key={idx}>{b.text}</h3>
                  )
                ) : b.type === "paragraph" ? (
                  <p key={idx}>{b.text}</p>
                ) : b.type === "image" ? (
                  <img
                    key={idx}
                    className="mdImage"
                    src={b.url}
                    alt={b.alt}
                    onClick={() => setImageModalUrl(b.url)}
                  />
                ) : (
                  <pre
                    key={idx}
                    className="mdCodeBlock"
                    role="button"
                    tabIndex={0}
                    onClick={() => setCodeModal({ lang: b.lang, code: b.code })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCodeModal({ lang: b.lang, code: b.code });
                      }
                    }}
                  >
                    <code>{b.code}</code>
                  </pre>
                )
              )}
            </div>
          )}
        </>
      )}

      {imageModalUrl ? (
        <Modal title="Image" onClose={() => setImageModalUrl(null)}>
          <img className="lightboxImage" src={imageModalUrl} alt="" />
        </Modal>
      ) : null}

      {codeModal ? (
        <Modal title={codeModal.lang ? `Code (${codeModal.lang})` : "Code"} onClose={() => setCodeModal(null)}>
          <div className="buttonRow">
            <button
              type="button"
              className="secondaryButton"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codeModal.code);
                } catch {
                  // Best-effort; some browsers require a user gesture or permissions.
                }
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="ghostButton"
              onClick={() => {
                // Stub for a future "lab" runner.
                // eslint-disable-next-line no-alert
                alert("Open in lab: stub (coming soon)");
              }}
            >
              Open in lab
            </button>
          </div>
          <pre className="modalCode">
            <code>{codeModal.code}</code>
          </pre>
        </Modal>
      ) : null}
    </div>
  );
}
