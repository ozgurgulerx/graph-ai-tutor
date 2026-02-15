import type { ReactNode } from "react";

type Part = { text: string; marked: boolean };

function splitMarked(value: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let marked = false;

  while (i < value.length) {
    if (!marked) {
      const open = value.indexOf("<mark>", i);
      if (open === -1) {
        parts.push({ text: value.slice(i), marked: false });
        break;
      }
      if (open > i) parts.push({ text: value.slice(i, open), marked: false });
      i = open + "<mark>".length;
      marked = true;
      continue;
    }

    const close = value.indexOf("</mark>", i);
    if (close === -1) {
      parts.push({ text: value.slice(i), marked: true });
      break;
    }
    if (close > i) parts.push({ text: value.slice(i, close), marked: true });
    i = close + "</mark>".length;
    marked = false;
  }

  return parts.filter((p) => p.text.length > 0);
}

export function HighlightedText(props: { value?: string | null; fallback?: string | null }): ReactNode {
  const text = props.value ?? props.fallback ?? "";
  if (!text) return null;

  const parts = splitMarked(text);
  if (parts.length === 0) return text;

  return (
    <>
      {parts.map((p, idx) =>
        p.marked ? (
          <mark key={idx}>{p.text}</mark>
        ) : (
          <span key={idx}>{p.text}</span>
        )
      )}
    </>
  );
}

