# Vault (Canonical Markdown)

This folder is the canonical "concept vault". The Postgres DB is treated as a derived index that can be rebuilt from these Markdown files.

## File format (v0)
Each concept is a Markdown file with YAML frontmatter:

```yaml
---
id: concept_vault_example
title: Example
kind: Concept
module: inference
l0: One-line definition (optional)
l1:
  - Bullet (optional)
l2:
  - Bullet (optional)
edges:
  - to: concept_other
    type: PREREQUISITE_OF
---
```

Run the indexer:
```bash
pnpm indexer:rebuild
```

