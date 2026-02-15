import { useEffect, useMemo, useRef, useState } from "react";

import type { ConceptSummary } from "@graph-ai-tutor/shared";

type Action = {
  id: string;
  label: string;
  onSelect: () => void;
};

type VisibleItem =
  | { type: "concept"; concept: ConceptSummary }
  | { type: "action"; action: Action };

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  actions: Action[];
  concepts?: ConceptSummary[];
  onSelectConcept?: (conceptId: string) => void;
};

export function CommandPalette({
  open,
  onClose,
  actions,
  concepts,
  onSelectConcept
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredConcepts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !concepts) return [];
    return concepts.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  }, [concepts, query]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  const visibleItems = useMemo<VisibleItem[]>(() => [
    ...filteredConcepts.map((c) => ({ type: "concept" as const, concept: c })),
    ...filteredActions.map((a) => ({ type: "action" as const, action: a }))
  ], [filteredConcepts, filteredActions]);

  const showConceptHeader = filteredConcepts.length > 0;
  const showActionHeader = filteredConcepts.length > 0 && filteredActions.length > 0;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleItems.length]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = visibleItems[selectedIndex];
        if (item) {
          if (item.type === "concept") {
            onSelectConcept?.(item.concept.id);
          } else {
            item.action.onSelect();
          }
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, visibleItems, selectedIndex, onSelectConcept]);

  if (!open) return null;

  function selectItem(item: VisibleItem) {
    if (item.type === "concept") {
      onSelectConcept?.(item.concept.id);
    } else {
      item.action.onSelect();
    }
    onClose();
  }

  function renderEmptyState() {
    const q = query.trim();
    if (q.length >= 2 && visibleItems.length === 0) {
      return <li className="commandPaletteEmpty">No results</li>;
    }
    if (visibleItems.length === 0) {
      return <li className="commandPaletteEmpty">Type to search concepts...</li>;
    }
    return null;
  }

  let flatIndex = 0;

  return (
    <div
      className="commandPaletteOverlay"
      data-testid="command-palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="commandPalette">
        <input
          ref={inputRef}
          className="commandPaletteInput"
          placeholder="Search concepts or type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="command-palette-input"
        />
        <ul className="commandPaletteList" role="listbox">
          {visibleItems.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {showConceptHeader && (
                <li className="commandPaletteGroup">Concepts</li>
              )}
              {filteredConcepts.map((c) => {
                const i = flatIndex++;
                return (
                  <li
                    key={`concept-${c.id}`}
                    role="option"
                    aria-selected={i === selectedIndex}
                    className={`commandPaletteItem ${i === selectedIndex ? "commandPaletteItemSelected" : ""}`}
                    onClick={() => selectItem({ type: "concept", concept: c })}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <span>{c.title}</span>
                    <span className="commandPaletteItemDetail">
                      {[c.kind, c.module].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                );
              })}
              {showActionHeader && (
                <li className="commandPaletteGroup">Actions</li>
              )}
              {filteredActions.map((action) => {
                const i = flatIndex++;
                return (
                  <li
                    key={`action-${action.id}`}
                    role="option"
                    aria-selected={i === selectedIndex}
                    className={`commandPaletteItem ${i === selectedIndex ? "commandPaletteItemSelected" : ""}`}
                    onClick={() => selectItem({ type: "action", action })}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    {action.label}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
