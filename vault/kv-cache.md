---
id: concept_vault_kv_cache
title: KV cache
kind: Concept
module: inference
l0: KV cache stores key/value tensors during decoding to avoid recomputing attention over prior tokens.
l1:
  - Improves throughput and latency for autoregressive decoding.
  - Memory/bandwidth cost grows with context length.
---

# KV cache

Minimal seed concept for the vault indexer.

