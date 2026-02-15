import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConceptSummary, Source } from "@graph-ai-tutor/shared";

import {
  getConceptBacklinks,
  postConceptNote,
  getSourceContent,
  postSourceContent,
  getUniversalSearch
} from "./api/client";
import { wikiLinkCompletion } from "./codemirror/wikiLinkCompletion";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; alt: string; url: string }
  | { type: "code"; lang: string | null; code: string };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
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

function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as HTMLElement).isContentEditable;
}

/** Render inline text with [[wiki links]] parsed into clickable buttons. */
function WikiText(props: {
  text: string;
  onOpenConcept?: (conceptId: string) => void;
  searchConcept?: (title: string) => void;
}) {
  const parts: Array<{ type: "text"; value: string } | { type: "wikilink"; title: string }> = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(props.text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: props.text.slice(last, m.index) });
    }
    parts.push({ type: "wikilink", title: m[1] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < props.text.length) {
    parts.push({ type: "text", value: props.text.slice(last) });
  }

  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <button
            key={i}
            type="button"
            className="wikiLink"
            onClick={() => props.searchConcept?.(p.title)}
          >
            {p.title}
          </button>
        )
      )}
    </>
  );
}

export function ConceptNoteSection(props: {
  conceptId: string;
  conceptTitle: string;
  noteSourceId: string | null;
  onNoteCreated?: (sourceId: string) => void;
  onOpenConcept?: (conceptId: string) => void;
}) {
  const { conceptId, conceptTitle, noteSourceId, onNoteCreated, onOpenConcept } = props;

  const [source, setSource] = useState<Source | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [backlinks, setBacklinks] = useState<ConceptSummary[]>([]);

  const blocks = useMemo(() => parseBlocks(content), [content]);

  // Load note on mount / noteSourceId change
  useEffect(() => {
    let cancelled = false;
    setEditing(false);
    setSaveStatus("idle");
    setSaveError(null);

    if (!noteSourceId) {
      setSource(null);
      setContent("");
      setDraft("");
      setLastSaved("");
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    getSourceContent(noteSourceId)
      .then((res) => {
        if (cancelled) return;
        setSource(res.source);
        setContent(res.content);
        setDraft(res.content);
        setLastSaved(res.content);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load note");
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
  }, [noteSourceId]);

  // Load backlinks
  useEffect(() => {
    let cancelled = false;
    getConceptBacklinks(conceptId)
      .then((res) => {
        if (cancelled) return;
        setBacklinks(res.concepts);
      })
      .catch(() => {
        if (cancelled) return;
        setBacklinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  // Toggle edit with E key
  useEffect(() => {
    if (!noteSourceId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== "e") return;
      if (isTypingElement(document.activeElement)) return;
      e.preventDefault();
      setEditing((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noteSourceId]);

  // Autosave 750ms debounce
  useEffect(() => {
    if (!noteSourceId) return;
    if (!editing) return;
    if (loading) return;
    if (draft === lastSaved) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSaveStatus("saving");
      setSaveError(null);
      postSourceContent(noteSourceId, { content: draft })
        .then(() => {
          if (cancelled) return;
          setContent(draft);
          setLastSaved(draft);
          setSaveStatus("saved");
          setSavedAt(Date.now());
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
  }, [noteSourceId, editing, loading, draft, lastSaved]);

  // CodeMirror editor
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const wikiSearchFn = useCallback(
    async (query: string): Promise<Array<{ id: string; title: string }>> => {
      try {
        const res = await getUniversalSearch(query, 8);
        return res.concepts.map((c) => ({ id: c.id, title: c.title }));
      } catch {
        return [];
      }
    },
    []
  );

  useEffect(() => {
    if (!editing) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }
    if (!editorHostRef.current) return;
    if (!noteSourceId) return;

    const state = EditorState.create({
      doc: draft,
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        wikiLinkCompletion(wikiSearchFn),
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
  }, [editing, noteSourceId]);

  // Sync draft to editor when externally updated
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === draft) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: draft } });
  }, [draft]);

  // Create note handler
  async function createNote() {
    setCreating(true);
    setError(null);
    try {
      const res = await postConceptNote(conceptId);
      setSource(res.source);
      setContent(`# ${conceptTitle}\n\n`);
      setDraft(`# ${conceptTitle}\n\n`);
      setLastSaved(`# ${conceptTitle}\n\n`);
      onNoteCreated?.(res.source.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  }

  // Navigate to concept via wiki-link
  function handleWikiLinkClick(title: string) {
    getUniversalSearch(title, 1)
      .then((res) => {
        const match = res.concepts[0];
        if (match) onOpenConcept?.(match.id);
      })
      .catch(() => {});
  }

  // Empty state
  if (!noteSourceId && !source) {
    return (
      <div className="noteEmptyState" data-testid="note-empty-state">
        <p className="mutedText">No note yet for this concept.</p>
        <button
          type="button"
          className="primaryButton"
          onClick={createNote}
          disabled={creating}
          data-testid="note-create"
        >
          {creating ? "Creating..." : "Create blank note"}
        </button>
        {error ? (
          <p role="alert" className="errorText">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sourcePanel" data-testid="concept-note-section">
      <div className="sourceHeader">
        <div>
          <h3 className="paneTitle">Note</h3>
        </div>
        <div className="buttonRow">
          <button
            type="button"
            className={!editing ? "primaryButton" : "secondaryButton"}
            onClick={() => setEditing((v) => !v)}
            disabled={loading}
            data-testid="note-edit-toggle"
          >
            {!editing ? "Edit (E)" : "Done"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mutedText">Loading note...</p>
      ) : error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : editing ? (
        <>
          <div className="saveStatusRow">
            <span className="mutedText" data-testid="note-save-status">
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

          <div className="codeMirrorHost" ref={editorHostRef} data-testid="note-editor" />
        </>
      ) : (
        <div className="sourceRead" data-testid="note-read-view">
          {blocks.length === 0 ? <p className="mutedText">(Empty)</p> : null}
          {blocks.map((b, idx) =>
            b.type === "heading" ? (
              b.level === 1 ? (
                <h2 key={idx}>{b.text}</h2>
              ) : (
                <h3 key={idx}>{b.text}</h3>
              )
            ) : b.type === "paragraph" ? (
              <p key={idx}>
                <WikiText
                  text={b.text}
                  onOpenConcept={onOpenConcept}
                  searchConcept={handleWikiLinkClick}
                />
              </p>
            ) : b.type === "image" ? (
              <img key={idx} className="mdImage" src={b.url} alt={b.alt} />
            ) : (
              <pre key={idx} className="mdCodeBlock">
                <code>{b.code}</code>
              </pre>
            )
          )}
        </div>
      )}

      {backlinks.length > 0 ? (
        <div className="conceptSection" data-testid="note-backlinks">
          <div className="sectionTitle">
            Mentioned by {backlinks.length} note{backlinks.length !== 1 ? "s" : ""}
          </div>
          <ul className="nodeList">
            {backlinks.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="linkButton"
                  onClick={() => onOpenConcept?.(c.id)}
                >
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
