import { useState } from "react";
import { EDGE_TYPE_CATEGORIES } from "@graph-ai-tutor/shared";
import type { EdgeType, EdgeTypeCategory } from "@graph-ai-tutor/shared";

export function EdgeTypeFilter(props: {
  selected: Set<EdgeType>;
  onToggle: (edgeType: EdgeType) => void;
  onToggleCategory: (category: EdgeTypeCategory) => void;
  disabled?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpand(categoryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <div className={props.disabled ? "edge-filter--disabled" : undefined}>
      <span className="edge-filter__title">Edge types</span>
      <div className="edge-filter__groups" role="group" aria-label="Edge type filters">
        {EDGE_TYPE_CATEGORIES.map((cat) => {
          const onCount = cat.types.filter((t) => props.selected.has(t)).length;
          const allOn = onCount === cat.types.length;
          const partial = onCount > 0 && !allOn;
          const expanded = expandedIds.has(cat.id);

          const chipClass = [
            "edge-filter__chip",
            allOn ? "edge-filter__chip--on" : "",
            partial ? "edge-filter__chip--partial" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={cat.id} className="edge-filter__group">
              <div className="edge-filter__group-header">
                <button
                  type="button"
                  className={chipClass}
                  onClick={() => props.onToggleCategory(cat)}
                  disabled={props.disabled}
                  aria-pressed={allOn}
                >
                  {cat.label} ({onCount}/{cat.types.length})
                </button>
                <button
                  type="button"
                  className="edge-filter__expand"
                  onClick={() => toggleExpand(cat.id)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${cat.label}`}
                >
                  {expanded ? "\u25B4" : "\u25BE"}
                </button>
              </div>
              {expanded ? (
                <div className="edge-filter__types">
                  {cat.types.map((t) => (
                    <label key={t} className="edge-filter__item">
                      <input
                        type="checkbox"
                        checked={props.selected.has(t)}
                        onChange={() => props.onToggle(t)}
                        disabled={props.disabled}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
