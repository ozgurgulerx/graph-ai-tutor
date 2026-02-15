import { useEffect, useMemo, useRef, useState } from "react";

import { EDGE_TYPE_CATEGORIES } from "@graph-ai-tutor/shared";
import type { EdgeType } from "@graph-ai-tutor/shared";

type EdgeTypePickerProps = {
  open: boolean;
  onSelect: (edgeType: EdgeType) => void;
  onClose: () => void;
};

export function EdgeTypePicker({ open, onSelect, onClose }: EdgeTypePickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Flatten all visible types for keyboard navigation
  const visibleTypes = useMemo(() => {
    const types: EdgeType[] = [];
    for (const cat of EDGE_TYPE_CATEGORIES) {
      if (expandedIds.has(cat.id)) {
        for (const t of cat.types) types.push(t);
      }
    }
    return types;
  }, [expandedIds]);

  useEffect(() => {
    if (open) {
      setExpandedIds(new Set());
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [expandedIds]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, visibleTypes.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const t = visibleTypes[selectedIndex];
        if (t) onSelect(t);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onSelect, visibleTypes, selectedIndex]);

  if (!open) return null;

  function toggleExpand(categoryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  let flatIndex = 0;

  return (
    <div
      className="edgeTypePickerOverlay"
      data-testid="edge-type-picker"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="edgeTypePicker">
        <div className="edgeTypePickerHeader">Select edge type</div>
        <ul className="edgeTypePickerList" ref={listRef} role="listbox">
          {EDGE_TYPE_CATEGORIES.map((cat) => {
            const expanded = expandedIds.has(cat.id);
            return (
              <li key={cat.id} className="edgeTypePickerGroup">
                <button
                  type="button"
                  className="edgeTypePickerGroupBtn"
                  onClick={() => toggleExpand(cat.id)}
                  aria-expanded={expanded}
                  data-testid={`edge-type-group-${cat.id}`}
                >
                  <span>{cat.label}</span>
                  <span className="edgeTypePickerArrow">
                    {expanded ? "\u25B4" : "\u25BE"}
                  </span>
                </button>
                {expanded ? (
                  <ul className="edgeTypePickerTypes">
                    {cat.types.map((t) => {
                      const i = flatIndex++;
                      return (
                        <li
                          key={t}
                          role="option"
                          aria-selected={i === selectedIndex}
                          className={`edgeTypePickerItem ${i === selectedIndex ? "edgeTypePickerItemSelected" : ""}`}
                          onClick={() => onSelect(t)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          data-testid={`edge-type-option-${t}`}
                        >
                          {t}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
