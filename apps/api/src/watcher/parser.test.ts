import { describe, expect, it } from "vitest";

import { extractWikiLinks, parseFrontmatter, parseMdFile } from "./parser";

describe("parseFrontmatter", () => {
  it("parses basic frontmatter fields", () => {
    const content = `---
id: concept_kv_cache
title: KV Cache
kind: Concept
module: inference
tags: [attention, caching]
---
Body text here.`;

    const fm = parseFrontmatter(content);
    expect(fm.id).toBe("concept_kv_cache");
    expect(fm.title).toBe("KV Cache");
    expect(fm.kind).toBe("Concept");
    expect(fm.module).toBe("inference");
    expect(fm.tags).toEqual(["attention", "caching"]);
  });

  it("returns empty object for no frontmatter", () => {
    const fm = parseFrontmatter("Just plain text");
    expect(fm).toEqual({});
  });

  it("handles missing optional fields", () => {
    const content = `---
title: Attention
---
Body`;

    const fm = parseFrontmatter(content);
    expect(fm.title).toBe("Attention");
    expect(fm.id).toBeUndefined();
    expect(fm.kind).toBeUndefined();
    expect(fm.module).toBeUndefined();
  });

  it("ignores invalid kind values", () => {
    const content = `---
title: Test
kind: InvalidKind
---`;

    const fm = parseFrontmatter(content);
    expect(fm.kind).toBeUndefined();
  });

  it("parses edge definitions", () => {
    const content = `---
title: Transformer
edges: [PREREQUISITE_OF Attention, USED_IN GPT]
---`;

    const fm = parseFrontmatter(content);
    expect(fm.edges).toEqual([
      { type: "PREREQUISITE_OF", target: "Attention" },
      { type: "USED_IN", target: "GPT" }
    ]);
  });

  it("handles quoted values", () => {
    const content = `---
title: "KV Cache"
module: 'inference'
---`;

    const fm = parseFrontmatter(content);
    expect(fm.title).toBe("KV Cache");
    expect(fm.module).toBe("inference");
  });
});

describe("extractWikiLinks", () => {
  it("extracts wiki-style links", () => {
    const text = "See [[Attention]] and [[KV Cache]] for more.";
    expect(extractWikiLinks(text)).toEqual(["Attention", "KV Cache"]);
  });

  it("deduplicates links", () => {
    const text = "Use [[Attention]] then [[Attention]] again.";
    expect(extractWikiLinks(text)).toEqual(["Attention"]);
  });

  it("returns empty array when no links", () => {
    expect(extractWikiLinks("No links here.")).toEqual([]);
  });

  it("handles links with whitespace", () => {
    const text = "See [[ Transformer ]] here.";
    expect(extractWikiLinks(text)).toEqual(["Transformer"]);
  });
});

describe("parseMdFile", () => {
  it("combines frontmatter and wiki-links", () => {
    const content = `---
title: Multi-Head Attention
module: transformers
---
This builds on [[Attention]] and relates to [[KV Cache]].`;

    const result = parseMdFile(content);
    expect(result.frontmatter.title).toBe("Multi-Head Attention");
    expect(result.frontmatter.module).toBe("transformers");
    expect(result.wikiLinks).toEqual(["Attention", "KV Cache"]);
    expect(result.body).toContain("This builds on");
  });

  it("works without frontmatter", () => {
    const content = "Just some text with [[Concepts]].";
    const result = parseMdFile(content);
    expect(result.frontmatter).toEqual({});
    expect(result.wikiLinks).toEqual(["Concepts"]);
  });
});
