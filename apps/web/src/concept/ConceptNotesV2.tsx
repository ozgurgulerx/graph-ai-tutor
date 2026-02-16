import { useEffect, useMemo, useRef, useState } from "react";

import type { Source } from "@graph-ai-tutor/shared";

import {
  getConceptSources,
  postConceptLocalSource,
  postConceptNote
} from "../api/client";
import { SourcePanel } from "../SourcePanel";

function isLocalNoteSource(source: Source): boolean {
  return source.url.startsWith("vault://notes/") || source.url.startsWith("vault://sources/");
}

function sortByCreatedDesc(a: Source, b: Source): number {
  return b.createdAt - a.createdAt;
}

export function ConceptNotesV2(props: {
  conceptId: string;
  conceptTitle: string;
  noteSourceId: string | null;
  autoCreateToken?: number;
  onPrimaryNoteCreated?: (sourceId: string) => void;
}) {
  const {
    conceptId,
    conceptTitle,
    noteSourceId,
    autoCreateToken,
    onPrimaryNoteCreated
  } = props;

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const lastAutoCreateTokenRef = useRef<number | null>(null);

  const noteSources = useMemo(
    () => sources.filter(isLocalNoteSource).sort(sortByCreatedDesc),
    [sources]
  );

  async function loadSources() {
    setLoading(true);
    setError(null);
    try {
      const res = await getConceptSources(conceptId);
      setSources(res.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load note sources");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedSourceId(null);
    lastAutoCreateTokenRef.current = null;
    void loadSources();
    // concept change should fully reset selection/create token state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  useEffect(() => {
    if (noteSources.length === 0) return;
    setSelectedSourceId((prev) => {
      if (prev && noteSources.some((s) => s.id === prev)) return prev;
      if (noteSourceId && noteSources.some((s) => s.id === noteSourceId)) return noteSourceId;
      return noteSources[0]!.id;
    });
  }, [noteSources, noteSourceId]);

  async function createNote() {
    setCreating(true);
    setError(null);

    try {
      let created: Source;
      if (!noteSourceId && noteSources.length === 0) {
        const res = await postConceptNote(conceptId, { title: `${conceptTitle} notes` });
        created = res.source;
        onPrimaryNoteCreated?.(created.id);
      } else {
        const res = await postConceptLocalSource(conceptId, {
          title: `${conceptTitle} notes`
        });
        created = res.source;
      }

      await loadSources();
      setSelectedSourceId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    const token = autoCreateToken;
    if (typeof token !== "number" || token <= 0) return;
    if (token === lastAutoCreateTokenRef.current) return;
    lastAutoCreateTokenRef.current = token;
    void createNote();
    // token intentionally drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateToken, conceptId]);

  return (
    <div className="conceptNotesV2" data-testid="concept-notes-v2">
      <div className="buttonRow">
        <button
          type="button"
          className="secondaryButton"
          onClick={() => void createNote()}
          disabled={creating}
        >
          {creating ? "Creating..." : "New note"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mutedText">Loading notes...</p>
      ) : noteSources.length === 0 ? (
        <p className="mutedText">(No notes yet)</p>
      ) : (
        <ul className="bullets conceptNotesV2List" aria-label="Concept notes">
          {noteSources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className={`linkButton conceptNotesV2Link${
                  selectedSourceId === source.id ? " conceptNotesV2LinkActive" : ""
                }`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                {source.title ?? source.url}
              </button>
              <span className="mutedText conceptNotesV2Meta">
                {new Date(source.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SourcePanel sourceId={selectedSourceId} onSaved={() => void loadSources()} />
    </div>
  );
}
