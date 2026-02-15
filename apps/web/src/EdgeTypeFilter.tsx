import { EdgeTypeSchema } from "@graph-ai-tutor/shared";
import type { EdgeType } from "@graph-ai-tutor/shared";

export function EdgeTypeFilter(props: {
  selected: Set<EdgeType>;
  onToggle: (edgeType: EdgeType) => void;
  disabled?: boolean;
}) {
  return (
    <div className={props.disabled ? "edge-filter--disabled" : undefined}>
      <span className="edge-filter__title">Edge types</span>
      <div className="edge-filter__list" role="group" aria-label="Edge type filters">
        {EdgeTypeSchema.options.map((t) => (
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
    </div>
  );
}

