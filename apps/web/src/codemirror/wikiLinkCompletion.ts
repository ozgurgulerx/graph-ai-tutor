import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

export function wikiLinkCompletion(
  searchFn: (query: string) => Promise<Array<{ id: string; title: string }>>
): Extension {
  return autocompletion({
    override: [
      async (ctx: CompletionContext): Promise<CompletionResult | null> => {
        // Match `[[query` before the cursor
        const match = ctx.matchBefore(/\[\[([^\]]*)/);
        if (!match) return null;

        const query = match.text.slice(2); // strip leading `[[`
        const from = match.from + 2; // position after `[[`

        if (query.length === 0) {
          return { from, options: [], filter: false };
        }

        const results = await searchFn(query);

        return {
          from,
          options: results.map((r) => ({
            label: r.title,
            apply: `${r.title}]]`,
            info: r.id
          })),
          filter: false
        };
      }
    ]
  });
}
