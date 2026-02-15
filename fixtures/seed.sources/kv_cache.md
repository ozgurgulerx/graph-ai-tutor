# KV cache (Key-Value cache)

KV cache is the per-layer cache of attention keys and values stored during autoregressive decoding.

Why it matters:
- It avoids recomputing keys/values for past tokens on every decoding step.
- It shifts the bottleneck toward memory bandwidth and cache size at long context lengths.

Rule of thumb: KV cache memory grows with sequence length * layers.

