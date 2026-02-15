import { useEffect, useMemo, useRef, useState } from "react";

type Action = {
  id: string;
  label: string;
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  actions: Action[];
};

export function CommandPalette({ open, onClose, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = filtered[selectedIndex];
        if (action) {
          action.onSelect();
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, filtered, selectedIndex]);

  if (!open) return null;

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
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="command-palette-input"
        />
        <ul className="commandPaletteList" role="listbox">
          {filtered.length === 0 ? (
            <li className="commandPaletteEmpty">No matching actions</li>
          ) : (
            filtered.map((action, i) => (
              <li
                key={action.id}
                role="option"
                aria-selected={i === selectedIndex}
                className={`commandPaletteItem ${i === selectedIndex ? "commandPaletteItemSelected" : ""}`}
                onClick={() => {
                  action.onSelect();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {action.label}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
