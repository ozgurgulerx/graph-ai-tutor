#!/usr/bin/env node
/**
 * Builds the full GenAI knowledge graph seed from the spec.
 * Run: node scripts/build-full-seed.mjs
 * Output: fixtures/seed.graph.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "fixtures", "seed.graph.json");

// Helpers
const concepts = [];
const edges = [];
const sources = [];
const chunks = [];
let edgeCounter = 0;

function c(id, title, kind, l0, l1 = [], l2 = [], module = null) {
  // derive module from second segment of id if not provided
  if (!module && id.includes(".")) {
    const parts = id.split(".");
    if (parts.length >= 2) module = parts[1];
  }
  concepts.push({ id, title, kind, l0, l1, l2, module });
}

function e(from, to, type, sourceUrl = null, confidence = null) {
  edgeCounter++;
  edges.push({
    id: `edge_${edgeCounter}`,
    fromConceptId: from,
    toConceptId: to,
    type,
    sourceUrl,
    confidence,
    verifierScore: null,
    evidenceChunkIds: [],
  });
}

function src(id, url, title) {
  sources.push({ id, url, title });
}

// ─────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────
c("genai", "Generative AI", "Domain",
  "A knowledge graph of generative AI concepts, methods, systems, risks, and practices.",
  ["Use stable hierarchical IDs (e.g. genai.systems_inference.kvcache.kv_cache)",
   "Prefer a small, consistent edge vocabulary",
   "Attach sources to nodes and evidence chunks to edges"],
  [], null);

// ─────────────────────────────────────────────
// 11 TOP-LEVEL DOMAINS
// ─────────────────────────────────────────────
c("genai.foundations", "Foundations & Theory", "Domain",
  "Core generative modeling paradigms, representations, scaling, and reliability concerns.", [], [], null);
c("genai.models", "Model Families & Architectures", "Domain",
  "Transformer and post-transformer model families and architectural variants.", [], [], null);
c("genai.training_alignment", "Training, Post-training & Alignment", "Domain",
  "Pretraining, fine-tuning, preference optimization, and safety training.", [], [], null);
c("genai.knowledge_memory", "Retrieval, Knowledge Integration & Memory", "Domain",
  "RAG, knowledge graphs, graph retrieval, and application memory architectures.", [], [], null);
c("genai.agents_tools", "Agents, Tool Use & Protocols", "Domain",
  "Agent architectures, tool-use primitives, and interoperability protocols.", [], [], null);
c("genai.llmops", "Evaluation, Observability & LLMOps", "Domain",
  "Evals, tracing, monitoring, prompt/model registries, and operational practice.", [], [], null);
c("genai.systems_inference", "Inference, Serving, Hardware & Systems", "Domain",
  "Inference optimization, serving systems, attention kernels, and hardware constraints.", [], [], null);
c("genai.security_safety", "Security, Safety & Red Teaming", "Domain",
  "Threats and mitigations for LLM applications, including prompt injection and tool abuse.", [], [], null);
c("genai.governance", "Responsible AI, Governance & Compliance", "Domain",
  "Risk frameworks, regulations, and governance artifacts for AI systems.", [], [], null);
c("genai.product_design", "AI UX/UI & Product Patterns", "Domain",
  "Human-AI interaction patterns and product design practices for GenAI features.", [], [], null);
c("genai.adaptive_flywheels", "Adaptive Systems & Data Flywheels", "Domain",
  "Instrumentation-to-improvement loops, personalization mechanisms, and flywheel failure modes.", [], [], null);

// HAS_MAJOR_AREA edges
const domains = ["foundations","models","training_alignment","knowledge_memory","agents_tools",
  "llmops","systems_inference","security_safety","governance","product_design","adaptive_flywheels"];
for (const d of domains) e("genai", `genai.${d}`, "HAS_MAJOR_AREA");

// ─────────────────────────────────────────────
// 2.1 FOUNDATIONS & THEORY
// ─────────────────────────────────────────────
c("genai.foundations.generative_paradigms", "Generative Modeling Paradigms", "Concept",
  "Core paradigms for how generative models produce outputs.");
c("genai.foundations.generative_paradigms.autoregressive", "Autoregressive Generation", "Concept",
  "Next-token (or next-patch) prediction; the dominant paradigm for LLMs.",
  ["Sequential left-to-right generation", "Scales well with compute and data"]);
c("genai.foundations.generative_paradigms.diffusion", "Diffusion / Denoising Processes", "Concept",
  "Generate data by iteratively denoising from noise; works for continuous and discrete tokens.",
  ["Dominant in image generation", "Discrete diffusion for text is frontier research"]);
c("genai.foundations.generative_paradigms.flow_based", "Flow-based / Rectified Flows", "Concept",
  "Invertible transformations between data and latent space; flow-matching is frontier for multimodal.");
c("genai.foundations.generative_paradigms.energy_based", "Energy-based Models", "Concept",
  "Define unnormalized probability via energy function; appears in reranking and reward modeling.");

c("genai.foundations.representation", "Representation & Tokenization", "Concept",
  "How inputs are converted to model-consumable representations.");
c("genai.foundations.representation.tokenization", "Tokenization", "Concept",
  "Splitting text (or other modalities) into subword/patch tokens for model input.",
  ["BPE, Unigram, WordPiece", "Multimodal tokenizers for images/audio"]);
c("genai.foundations.representation.embeddings", "Embeddings", "Concept",
  "Dense vector representations of tokens, positions, segments, and modalities.");
c("genai.foundations.representation.latent_spaces", "Latent Spaces", "Concept",
  "Learned continuous spaces for text, images, or cross-modal alignment.");

c("genai.foundations.scaling", "Generalization & Scaling", "Concept",
  "How model capability scales with compute, data, and parameters.");
c("genai.foundations.scaling.scaling_laws", "Scaling Laws", "Concept",
  "Predictable relationships between compute, data size, model size, and loss.",
  ["Chinchilla-optimal compute allocation", "Inform training budget decisions"]);
c("genai.foundations.scaling.data_quality", "Data Quality > Quantity", "Concept",
  "Filtering, deduplication, and mixture design often matter more than raw data volume.");
c("genai.foundations.scaling.test_time_compute", "Test-time Compute Scaling", "Concept",
  "Spending more inference compute (search, retry, chain-of-thought) to improve reasoning quality.",
  ["Best-of-N, tree search, chain-of-thought", "Frontier efficiency: compute-optimal allocation per prompt"]);

c("genai.foundations.uncertainty", "Uncertainty & Calibration", "Concept",
  "Quantifying and communicating model confidence.");
c("genai.foundations.uncertainty.confidence_estimation", "Confidence Estimation", "Concept",
  "Methods to estimate how confident a model is in its outputs.");
c("genai.foundations.uncertainty.selective_prediction", "Selective Prediction / Abstention", "Concept",
  "Choosing not to answer when the model is insufficiently confident.");
c("genai.foundations.uncertainty.calibration", "Calibration", "Concept",
  "Ensuring predicted probabilities match actual correctness rates.",
  ["Temperature scaling", "Conformal prediction approaches"]);

c("genai.foundations.problem_families", "Key Problem Families", "Concept",
  "Fundamental challenge areas that cut across all GenAI work.");
c("genai.foundations.problem_families.reasoning", "Reasoning (Math, Logic, Planning)", "Concept",
  "Multi-step logical inference, mathematical problem-solving, and planning.");
c("genai.foundations.problem_families.factuality", "Factuality / Grounding / Citations", "Concept",
  "Ensuring model outputs are grounded in verifiable facts with proper attribution.");
c("genai.foundations.problem_families.safety", "Safety / Harmlessness / Policy Compliance", "Concept",
  "Preventing harmful, biased, or policy-violating outputs.");
c("genai.foundations.problem_families.robustness", "Robustness (OOD, Adversarial)", "Concept",
  "Maintaining quality under distribution shift and adversarial inputs.");
c("genai.foundations.problem_families.personalization_privacy", "Personalization vs Privacy", "Concept",
  "Balancing user-specific adaptation with data protection and consent.");

// Foundations structural edges
e("genai.foundations", "genai.foundations.generative_paradigms", "PART_OF");
e("genai.foundations", "genai.foundations.representation", "PART_OF");
e("genai.foundations", "genai.foundations.scaling", "PART_OF");
e("genai.foundations", "genai.foundations.uncertainty", "PART_OF");
e("genai.foundations", "genai.foundations.problem_families", "PART_OF");
// sub-parts
for (const sub of ["autoregressive","diffusion","flow_based","energy_based"])
  e("genai.foundations.generative_paradigms", `genai.foundations.generative_paradigms.${sub}`, "PART_OF");
for (const sub of ["tokenization","embeddings","latent_spaces"])
  e("genai.foundations.representation", `genai.foundations.representation.${sub}`, "PART_OF");
for (const sub of ["scaling_laws","data_quality","test_time_compute"])
  e("genai.foundations.scaling", `genai.foundations.scaling.${sub}`, "PART_OF");
for (const sub of ["confidence_estimation","selective_prediction","calibration"])
  e("genai.foundations.uncertainty", `genai.foundations.uncertainty.${sub}`, "PART_OF");
for (const sub of ["reasoning","factuality","safety","robustness","personalization_privacy"])
  e("genai.foundations.problem_families", `genai.foundations.problem_families.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.2 MODEL FAMILIES & ARCHITECTURES
// ─────────────────────────────────────────────

// A) Transformer family
c("genai.models.transformer", "Transformer Family", "Architecture",
  "The dominant architecture family for LLMs and many multimodal models.",
  ["Decoder-only, encoder-decoder, encoder-only archetypes",
   "Attention mechanism is the core computational primitive"]);
c("genai.models.transformer.decoder_only", "Decoder-only Transformer", "Architecture",
  "Autoregressive transformer used by most modern LLMs (GPT, LLaMA, etc.).");
c("genai.models.transformer.encoder_decoder", "Encoder-Decoder Transformer", "Architecture",
  "Seq2seq transformer for translation, summarization (T5, BART).");
c("genai.models.transformer.encoder_only", "Encoder-only Transformer", "Architecture",
  "Bidirectional transformer for embeddings, retrieval, classification (BERT).");

c("genai.models.transformer.attention", "Attention Mechanisms", "Concept",
  "Core computational primitive of transformers; mixes information across tokens.");
c("genai.models.transformer.attention.self_attention", "Self-attention", "Concept",
  "A mechanism that mixes information across tokens using query-key matching.",
  ["Q, K, V projections", "Softmax(QK^T) attention weights", "Weighted sum of V"]);
c("genai.models.transformer.attention.mha", "Multi-Head Attention (MHA)", "Concept",
  "Standard attention with multiple independent heads for diverse feature capture.");
c("genai.models.transformer.attention.mqa_gqa", "Multi-Query / Grouped-Query Attention", "Concept",
  "Share K/V heads across query heads to reduce KV cache size and improve throughput.",
  ["MQA: single K/V head", "GQA: grouped K/V heads (balance between MHA and MQA)"]);
c("genai.models.transformer.attention.block_sparse", "Block-sparse Attention", "Concept",
  "Attend to blocks of tokens instead of all tokens; frontier for very long context.");
c("genai.models.transformer.attention.sparse_linear", "Sparse / Linear Attention", "Concept",
  "Approximate attention with subquadratic complexity; various tradeoffs with quality.");

c("genai.models.transformer.positional_encoding", "Positional Encoding & Long-context", "Concept",
  "Methods to inject position information and support long sequences.");
c("genai.models.transformer.positional_encoding.rope", "RoPE (Rotary Position Embedding)", "Concept",
  "Rotary embeddings that encode relative position via rotation matrices; widely used in modern LLMs.",
  ["RoPE scaling families extend context length"]);
c("genai.models.transformer.positional_encoding.alibi", "ALiBi", "Concept",
  "Attention with Linear Biases; adds linear position penalty to attention scores.");
c("genai.models.transformer.positional_encoding.sliding_window", "Sliding-window Attention", "Concept",
  "Each token attends only to a fixed window of nearby tokens; used in Mistral and others.");
c("genai.models.transformer.positional_encoding.memory_augmented", "Memory-augmented Attention", "Concept",
  "Recurrence or segment-level memory to extend effective context beyond the window.");

c("genai.models.transformer.normalization", "Normalization & Residual Design", "Concept",
  "Layer normalization variants and residual connection patterns.");
c("genai.models.transformer.normalization.pre_norm", "Pre-norm vs Post-norm", "Concept",
  "Pre-norm (normalize before attention/FFN) is standard in modern LLMs; post-norm was original.");
c("genai.models.transformer.normalization.rmsnorm", "RMSNorm / LayerNorm Variants", "Concept",
  "RMSNorm removes mean centering for efficiency; widely adopted in modern architectures.");

c("genai.models.transformer.output_heads", "Output Heads", "Concept",
  "How the transformer produces final predictions.");
c("genai.models.transformer.output_heads.lm_head", "Standard LM Head", "Concept",
  "Linear projection to vocabulary logits for next-token prediction.");
c("genai.models.transformer.output_heads.multi_token", "Multi-token Prediction Heads", "Concept",
  "Predict multiple future tokens simultaneously; frontier research for faster generation.");
c("genai.models.transformer.output_heads.structured_generation", "Structured Generation (Constrained Decoding)", "Concept",
  "Constrain decoding to valid JSON, SQL, or other schemas via grammar-guided sampling.");

// Transformer structural edges
e("genai.models", "genai.models.transformer", "PART_OF");
for (const sub of ["decoder_only","encoder_decoder","encoder_only"])
  e("genai.models.transformer", `genai.models.transformer.${sub}`, "IS_A");
e("genai.models.transformer", "genai.models.transformer.attention", "PART_OF");
e("genai.models.transformer", "genai.models.transformer.positional_encoding", "PART_OF");
e("genai.models.transformer", "genai.models.transformer.normalization", "PART_OF");
e("genai.models.transformer", "genai.models.transformer.output_heads", "PART_OF");
for (const sub of ["self_attention","mha","mqa_gqa","block_sparse","sparse_linear"])
  e("genai.models.transformer.attention", `genai.models.transformer.attention.${sub}`, "PART_OF");
for (const sub of ["rope","alibi","sliding_window","memory_augmented"])
  e("genai.models.transformer.positional_encoding", `genai.models.transformer.positional_encoding.${sub}`, "PART_OF");
for (const sub of ["pre_norm","rmsnorm"])
  e("genai.models.transformer.normalization", `genai.models.transformer.normalization.${sub}`, "PART_OF");
for (const sub of ["lm_head","multi_token","structured_generation"])
  e("genai.models.transformer.output_heads", `genai.models.transformer.output_heads.${sub}`, "PART_OF");

// B) MoE family
c("genai.models.moe", "Mixture-of-Experts (MoE)", "Architecture",
  "Sparse architecture where only a subset of expert networks activate per token.",
  ["Experts, router/gating network, token-to-expert assignment",
   "Load balancing loss, routing stability",
   "Expert parallelism for distributed training/serving"]);
c("genai.models.moe.switch_transformer", "Switch Transformer", "Architecture",
  "Simplified MoE with one expert per token; demonstrated efficient MoE scaling.");
c("genai.models.moe.routing_robustness", "Routing Robustness & Security", "Concept",
  "Router manipulation attacks and stability concerns in MoE models.");
c("genai.models.moe.moe_quantization", "MoE + Quantization / Distillation", "Concept",
  "Combining MoE sparsity with quantization or distillation for efficiency.");
c("genai.models.moe.heterogeneous_experts", "Heterogeneous Experts", "Concept",
  "Specialized experts for different domains or tools rather than identical architectures.");
c("genai.models.moe.multimodal_moe", "MoE for Multimodal", "Concept",
  "Applying MoE to handle different modalities with specialized expert pathways.");

e("genai.models", "genai.models.moe", "PART_OF");
e("genai.models.moe", "genai.models.moe.switch_transformer", "IS_A");
for (const sub of ["routing_robustness","moe_quantization","heterogeneous_experts","multimodal_moe"])
  e("genai.models.moe", `genai.models.moe.${sub}`, "PART_OF");

// C) SSM family
c("genai.models.ssm", "State Space Models (SSMs)", "Architecture",
  "Sequence models based on state space formulations; compete with attention for long sequences.",
  ["Lower KV-cache pressure than transformers", "Advantages for streaming and edge/on-device"]);
c("genai.models.ssm.s4", "Structured SSMs (S4)", "Architecture",
  "Structured state space model that handles very long sequences efficiently.");
c("genai.models.ssm.mamba", "Mamba (Selective SSM)", "Architecture",
  "Selective state space model; a serious competitor for long-sequence tasks.",
  ["Input-dependent selection mechanism", "Hardware-aware algorithm design"]);
c("genai.models.ssm.mamba2", "Mamba-2 / State Space Duality", "Architecture",
  "Unifies transformers and SSMs via state space duality framing with speedups.");
c("genai.models.ssm.moe_mamba", "MoE-Mamba", "Architecture",
  "Combines Mixture-of-Experts sparsity with SSM sequence modeling.");
c("genai.models.ssm.multimodal_ssm", "Multimodal SSM Variants", "Concept",
  "Applying SSM architectures to multimodal inputs; active research direction.");

e("genai.models", "genai.models.ssm", "PART_OF");
for (const sub of ["s4","mamba","mamba2","moe_mamba"])
  e("genai.models.ssm", `genai.models.ssm.${sub}`, "IS_A");
e("genai.models.ssm", "genai.models.ssm.multimodal_ssm", "PART_OF");
e("genai.models.ssm.mamba2", "genai.models.transformer", "CONTRASTS_WITH");

// D) Diffusion Language Models
c("genai.models.diffusion_lm", "Diffusion Language Models", "Architecture",
  "Text generation via discrete diffusion processes rather than autoregressive decoding.");
c("genai.models.diffusion_lm.discrete_diffusion", "Discrete Diffusion for Language", "Concept",
  "Diffusion trained from scratch for text under pretrain + SFT paradigm (e.g., LLaDA direction).");
c("genai.models.diffusion_lm.parallel_decoding", "Parallel Decoding vs AR Tradeoffs", "Concept",
  "Diffusion enables parallel token generation but may trade off controllability and factuality.");

e("genai.models", "genai.models.diffusion_lm", "PART_OF");
e("genai.models.diffusion_lm", "genai.models.diffusion_lm.discrete_diffusion", "PART_OF");
e("genai.models.diffusion_lm", "genai.models.diffusion_lm.parallel_decoding", "PART_OF");
e("genai.models.diffusion_lm", "genai.foundations.generative_paradigms.diffusion", "INSTANCE_OF");

// E) Reasoning-centric models
c("genai.models.reasoning_models", "Reasoning-centric Models", "Architecture",
  "Models designed for complex reasoning via RL and test-time compute scaling.",
  ["e.g. OpenAI o1 framing, DeepSeek-R1 research line"]);
c("genai.models.reasoning_models.rl_reasoning", "RL-heavy Reasoning Models", "Method",
  "Pure-RL incentives for emergent reasoning patterns without heavy supervised traces.");
c("genai.models.reasoning_models.tts", "Test-time Compute Scaling (TTS)", "Concept",
  "Allocating more inference compute to improve answer quality on hard problems.");
c("genai.models.reasoning_models.tts.best_of_n", "Best-of-N / Self-consistency", "Method",
  "Sample multiple completions and select the best via voting or a verifier.");
c("genai.models.reasoning_models.tts.tree_search", "Tree Search / MCTS over Reasoning", "Method",
  "Explore a tree of reasoning traces using Monte Carlo Tree Search.");
c("genai.models.reasoning_models.tts.compute_optimal", "Compute-optimal Allocation per Prompt", "Concept",
  "Route easy prompts to cheap paths and hard prompts to expensive reasoning; frontier efficiency.");
c("genai.models.reasoning_models.latent_reasoning", "Latent Reasoning via Recurrence", "Concept",
  "Frontier architecture concept: recurrent unrolling for reasoning in latent space.");

e("genai.models", "genai.models.reasoning_models", "PART_OF");
e("genai.models.reasoning_models", "genai.models.reasoning_models.rl_reasoning", "PART_OF");
e("genai.models.reasoning_models", "genai.models.reasoning_models.tts", "PART_OF");
for (const sub of ["best_of_n","tree_search","compute_optimal"])
  e("genai.models.reasoning_models.tts", `genai.models.reasoning_models.tts.${sub}`, "PART_OF");
e("genai.models.reasoning_models", "genai.models.reasoning_models.latent_reasoning", "PART_OF");
e("genai.models.reasoning_models.tts", "genai.foundations.scaling.test_time_compute", "INSTANCE_OF");

// F) Liquid Foundation Models
c("genai.models.liquid_fms", "Liquid Foundation Models (LFMs)", "Architecture",
  "On-device-first foundation models optimized for speed, memory-efficiency, and edge resilience.",
  ["Liquid AI positioning", "Cross-links to edge inference, privacy, adaptive systems"]);

e("genai.models", "genai.models.liquid_fms", "PART_OF");
e("genai.models.liquid_fms", "genai.systems_inference.deployment.edge_device", "ENABLES");

// ─────────────────────────────────────────────
// 2.3 TRAINING, POST-TRAINING & ALIGNMENT
// ─────────────────────────────────────────────

// A) Pretraining
c("genai.training_alignment.pretraining", "Pretraining & Data Curriculum", "Concept",
  "Large-scale training on web data with carefully designed data mixtures.");
c("genai.training_alignment.pretraining.web_scale", "Web-scale Pretraining", "Concept",
  "Training on internet-scale text corpora (Common Crawl, etc.).");
c("genai.training_alignment.pretraining.dapt", "Domain-adaptive Pretraining (DAPT)", "Method",
  "Continue pretraining on domain-specific corpora to specialize a foundation model.");
c("genai.training_alignment.pretraining.continued", "Continued Pretraining", "Method",
  "Extend pretraining on new data for specialization or knowledge updates.");
c("genai.training_alignment.pretraining.data_mixture", "Data Mixture Design", "Concept",
  "Choosing proportions of code, math, multilingual, instruction, and other data types.");
c("genai.training_alignment.pretraining.dedup_filtering", "Deduplication, Filtering & Decontamination", "Method",
  "Remove duplicates, low-quality content, and benchmark data leakage from training sets.");
c("genai.training_alignment.pretraining.synthetic_data", "Synthetic Data Generation", "Method",
  "Teacher→student pipelines where a stronger model generates training data for a weaker one.");

e("genai.training_alignment", "genai.training_alignment.pretraining", "PART_OF");
for (const sub of ["web_scale","dapt","continued","data_mixture","dedup_filtering","synthetic_data"])
  e("genai.training_alignment.pretraining", `genai.training_alignment.pretraining.${sub}`, "PART_OF");

// B) Fine-tuning
c("genai.training_alignment.finetuning", "Fine-tuning Methods", "Concept",
  "Adapting a pretrained model to specific tasks or behaviors.");
c("genai.training_alignment.finetuning.sft", "Supervised Fine-Tuning (SFT)", "Method",
  "Train on curated (instruction, response) pairs to teach instruction-following.");
c("genai.training_alignment.finetuning.peft", "Parameter-efficient Fine-tuning (PEFT)", "Method",
  "Update only a small subset of parameters to reduce compute and memory.",
  ["LoRA, QLoRA, adapters, prefix tuning"]);
c("genai.training_alignment.finetuning.lora", "LoRA / QLoRA", "Method",
  "Low-Rank Adaptation: inject trainable low-rank matrices into frozen weights.",
  ["QLoRA adds quantization for memory efficiency"]);
c("genai.training_alignment.finetuning.adapters", "Adapters / Prefix Tuning", "Method",
  "Insert small trainable modules or prepend learnable tokens to frozen models.");
c("genai.training_alignment.finetuning.distillation", "Distillation", "Method",
  "Transfer knowledge from a larger teacher to a smaller student model.");
c("genai.training_alignment.finetuning.logit_distillation", "Logit Distillation", "Method",
  "Student matches teacher's output probability distribution.");
c("genai.training_alignment.finetuning.preference_distillation", "Preference Distillation", "Method",
  "Distill preference rankings from a teacher judge into a student.");
c("genai.training_alignment.finetuning.reasoning_trace_distillation", "Reasoning Trace Distillation", "Method",
  "Distill chain-of-thought traces; risk of overfitting to style rather than capability.");

e("genai.training_alignment", "genai.training_alignment.finetuning", "PART_OF");
for (const sub of ["sft","peft","distillation"])
  e("genai.training_alignment.finetuning", `genai.training_alignment.finetuning.${sub}`, "PART_OF");
e("genai.training_alignment.finetuning.peft", "genai.training_alignment.finetuning.lora", "PART_OF");
e("genai.training_alignment.finetuning.peft", "genai.training_alignment.finetuning.adapters", "PART_OF");
for (const sub of ["logit_distillation","preference_distillation","reasoning_trace_distillation"])
  e("genai.training_alignment.finetuning.distillation", `genai.training_alignment.finetuning.${sub}`, "IS_A");

// C) RLFT (Reinforcement Learning from Feedback)
c("genai.training_alignment.rlft", "Reinforcement Learning from Feedback (RLFT)", "Concept",
  "Umbrella for preference-based training: RLHF, DPO, RLAIF, Constitutional AI.",
  ["Core post-training technique for alignment", "Alternatives trade off simplicity vs flexibility"]);
c("genai.training_alignment.rlft.rlhf", "RLHF", "Method",
  "Reinforcement Learning from Human Feedback; the canonical alignment pipeline.",
  ["Train reward model from human comparisons", "Optimize policy with PPO against reward model"]);
c("genai.training_alignment.rlft.dpo", "Direct Preference Optimization (DPO)", "Method",
  "Simpler alternative to RLHF: optimize preferences directly without a separate reward model.");
c("genai.training_alignment.rlft.rlaif", "RLAIF (AI Feedback)", "Method",
  "Use AI-generated feedback instead of human feedback for reinforcement learning.");
c("genai.training_alignment.rlft.constitutional_ai", "Constitutional AI", "Method",
  "Harmlessness from AI feedback guided by explicit principles; self-improvement loop.");
c("genai.training_alignment.rlft.process_supervision", "Process Supervision / PRMs", "Method",
  "Reward each reasoning step (not just final answer); more reliable for reasoning tasks.",
  ["Process Reward Models (PRMs)", "MCTS-generated supervision signals (frontier)"]);

e("genai.training_alignment", "genai.training_alignment.rlft", "PART_OF");
for (const sub of ["rlhf","dpo","rlaif","constitutional_ai","process_supervision"])
  e("genai.training_alignment.rlft", `genai.training_alignment.rlft.${sub}`, "PART_OF");
e("genai.training_alignment.rlft.dpo", "genai.training_alignment.rlft.rlhf", "CONTRASTS_WITH");

// D) Alignment targets
c("genai.training_alignment.alignment_targets", "Alignment Targets", "Concept",
  "What the model is aligned to: helpfulness, safety, policy, style, tool correctness.");
c("genai.training_alignment.alignment_targets.hhh", "Helpfulness, Harmlessness, Honesty", "Concept",
  "The classic HHH alignment triple from Anthropic's framing.");
c("genai.training_alignment.alignment_targets.policy_compliance", "Policy Compliance / Instruction Hierarchy", "Concept",
  "Following system-level policies even when user instructions conflict.");
c("genai.training_alignment.alignment_targets.style_brand", "Style / Brand Voice", "Concept",
  "Aligning model outputs to a specific tone, personality, or brand guidelines.");
c("genai.training_alignment.alignment_targets.domain_constraints", "Domain Constraints", "Concept",
  "Medical, legal, financial, or other domain-specific behavioral guidelines.");
c("genai.training_alignment.alignment_targets.tool_correctness", "Tool-usage Correctness", "Concept",
  "Ensuring the model calls APIs/tools with correct arguments and follows contracts.");
c("genai.training_alignment.alignment_targets.deliberative_alignment", "Deliberative Alignment", "Concept",
  "Model explicitly reasons about safety policies before responding (as in o1 system card).");

e("genai.training_alignment", "genai.training_alignment.alignment_targets", "PART_OF");
for (const sub of ["hhh","policy_compliance","style_brand","domain_constraints","tool_correctness","deliberative_alignment"])
  e("genai.training_alignment.alignment_targets", `genai.training_alignment.alignment_targets.${sub}`, "PART_OF");

// E) Safety training
c("genai.training_alignment.safety_training", "Safety Training & Robustness", "Concept",
  "Training techniques to make models resistant to adversarial attacks and misuse.");
c("genai.training_alignment.safety_training.adversarial", "Adversarial Training", "Method",
  "Train on jailbreak variants and adversarial inputs to improve robustness.");
c("genai.training_alignment.safety_training.refusal", "Refusal Training & Safe Completion", "Method",
  "Train the model to refuse harmful requests while remaining helpful.");
c("genai.training_alignment.safety_training.pi_robustness", "Prompt Injection Robustness Training", "Method",
  "Training to resist prompt injection; limited guarantees but still important.");
c("genai.training_alignment.safety_training.poisoning_defense", "Data Poisoning Defenses", "Control",
  "Filters and provenance checks to detect and prevent training data poisoning.");

e("genai.training_alignment", "genai.training_alignment.safety_training", "PART_OF");
for (const sub of ["adversarial","refusal","pi_robustness","poisoning_defense"])
  e("genai.training_alignment.safety_training", `genai.training_alignment.safety_training.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.4 RETRIEVAL, KNOWLEDGE INTEGRATION & MEMORY
// ─────────────────────────────────────────────

// RAG core pipeline
c("genai.knowledge_memory.rag", "Retrieval-Augmented Generation (RAG)", "Method",
  "Augment generation with retrieved context (documents, chunks, or structured knowledge) to improve grounding.",
  ["Index -> retrieve -> rerank -> generate", "Citations and quote windows help grounding"]);
c("genai.knowledge_memory.rag.indexing", "RAG Indexing", "Concept",
  "Preparing documents for retrieval: chunking, embedding, metadata enrichment.");
c("genai.knowledge_memory.rag.indexing.chunking", "Chunking Strategies", "Concept",
  "Fixed-size, semantic, or structure-aware splitting of documents into retrievable units.");
c("genai.knowledge_memory.rag.indexing.metadata_enrichment", "Metadata Enrichment", "Concept",
  "Adding source, timestamps, ACLs, entity tags to chunks for filtered retrieval.");
c("genai.knowledge_memory.rag.retrieval", "RAG Retrieval", "Concept",
  "Finding relevant chunks: dense vectors, sparse matching, hybrid approaches.");
c("genai.knowledge_memory.rag.retrieval.dense_vector", "Dense Vector Retrieval", "Method",
  "Embed queries and documents into a shared vector space; retrieve by similarity.");
c("genai.knowledge_memory.rag.retrieval.sparse_hybrid", "Sparse (BM25) & Hybrid Retrieval", "Method",
  "Combine keyword-based (BM25) and dense retrieval for better coverage.");
c("genai.knowledge_memory.rag.retrieval.reranking", "Reranking", "Method",
  "Re-score initial retrieval results with cross-encoders or LLM judges for higher precision.");
c("genai.knowledge_memory.rag.generation", "RAG Generation & Attribution", "Concept",
  "Prompt augmentation with citations, quote windows, and grounding strategies.");

e("genai.knowledge_memory", "genai.knowledge_memory.rag", "PART_OF");
e("genai.knowledge_memory.rag", "genai.knowledge_memory.rag.indexing", "PART_OF");
e("genai.knowledge_memory.rag", "genai.knowledge_memory.rag.retrieval", "PART_OF");
e("genai.knowledge_memory.rag", "genai.knowledge_memory.rag.generation", "PART_OF");
e("genai.knowledge_memory.rag.indexing", "genai.knowledge_memory.rag.indexing.chunking", "PART_OF");
e("genai.knowledge_memory.rag.indexing", "genai.knowledge_memory.rag.indexing.metadata_enrichment", "PART_OF");
for (const sub of ["dense_vector","sparse_hybrid","reranking"])
  e("genai.knowledge_memory.rag.retrieval", `genai.knowledge_memory.rag.retrieval.${sub}`, "PART_OF");

// RAG types
c("genai.knowledge_memory.rag.types.naive", "Naive RAG", "Pattern",
  "Single retrieve → generate; simplest RAG pattern.");
c("genai.knowledge_memory.rag.types.multi_stage", "Multi-stage RAG", "Pattern",
  "Query rewrite → retrieve → rerank → generate; with optional decomposition for multi-hop.");
c("genai.knowledge_memory.rag.types.adaptive", "Adaptive / Selective RAG", "Pattern",
  "Retrieve only when needed; a router decides whether retrieval would help.");
c("genai.knowledge_memory.rag.types.agentic", "Agentic RAG", "Pattern",
  "Retrieval as a tool used iteratively during agent planning and execution.");
c("genai.knowledge_memory.rag.types.multi_index", "Multi-index RAG", "Pattern",
  "Query multiple corpora with different retrieval policies and merge results.");
c("genai.knowledge_memory.rag.types.multimodal", "Multimodal RAG", "Pattern",
  "Retrieve and integrate image, video, audio content alongside text.");

for (const sub of ["naive","multi_stage","adaptive","agentic","multi_index","multimodal"])
  e("genai.knowledge_memory.rag", `genai.knowledge_memory.rag.types.${sub}`, "IS_A");

// Frontier RAG
c("genai.knowledge_memory.rag.graphrag", "GraphRAG", "Method",
  "A RAG approach that builds/uses a graph over a corpus (entities/relations/communities) to improve multi-hop QA.",
  ["Graph construction pipeline (entity/relation extraction, canonicalization)",
   "Graph traversal + text retrieval can complement each other"]);
c("genai.knowledge_memory.rag.self_rag", "Self-RAG", "Method",
  "Retrieve/generate/critique with self-reflection tokens for adaptive retrieval decisions.");
c("genai.knowledge_memory.rag.rag_fusion", "RAG-Fusion", "Method",
  "Generate multiple query variants and merge results via reciprocal rank fusion.");
c("genai.knowledge_memory.rag.rewrite_retrieve_read", "Rewrite-Retrieve-Read", "Method",
  "Rewrite the user query before retrieval to improve relevance.");
c("genai.knowledge_memory.rag.self_routing", "Self-routing RAG", "Method",
  "Selective retrieval + knowledge verbalization via router logic.");

for (const sub of ["graphrag","self_rag","rag_fusion","rewrite_retrieve_read","self_routing"])
  e("genai.knowledge_memory.rag", `genai.knowledge_memory.rag.${sub}`, "IS_A");

// Knowledge graphs
c("genai.knowledge_memory.graph", "Knowledge Graphs", "Concept",
  "Structured representations of entities and relations for multi-hop reasoning.");
c("genai.knowledge_memory.graph.entity_extraction", "Entity Extraction", "Method",
  "Identify and extract entities from text for graph construction.");
c("genai.knowledge_memory.graph.relation_extraction", "Relation Extraction", "Method",
  "Identify relationships between entities from text.");
c("genai.knowledge_memory.graph.entity_resolution", "Entity Resolution", "Method",
  "Canonicalize and merge mentions that refer to the same entity/concept.");
c("genai.knowledge_memory.graph.ontology_alignment", "Ontology Alignment", "Method",
  "Map entities/relations between different ontologies or knowledge bases.");
c("genai.knowledge_memory.graph.graph_traversal", "Graph Traversal for Multi-hop QA", "Method",
  "Walk the graph to answer questions requiring multiple reasoning steps.");
c("genai.knowledge_memory.graph.graph_embeddings", "Graph Embeddings", "Method",
  "Node2vec, GNNs, text+graph hybrid embeddings for graph-based retrieval.");
c("genai.knowledge_memory.graph.query_planning", "Query Planning over Graph + Text", "Method",
  "Combine graph traversal with text retrieval for complex questions.");
c("genai.knowledge_memory.graph.graph_grounding", "Graph Grounding & Citation", "Concept",
  "Cite graph facts + source text spans for verifiable answers.");

e("genai.knowledge_memory", "genai.knowledge_memory.graph", "PART_OF");
for (const sub of ["entity_extraction","relation_extraction","entity_resolution","ontology_alignment","graph_traversal","graph_embeddings","query_planning","graph_grounding"])
  e("genai.knowledge_memory.graph", `genai.knowledge_memory.graph.${sub}`, "PART_OF");

// Memory architectures
c("genai.knowledge_memory.memory", "Memory Architectures", "Concept",
  "Application-level memory for LLM systems (not just KV cache).");
c("genai.knowledge_memory.memory.short_term", "Short-term / Working Memory", "Concept",
  "Conversation window management and summarization buffers.");
c("genai.knowledge_memory.memory.long_term", "Long-term Memory", "Concept",
  "Persistent vector memory (episodic), structured facts/preferences, knowledge graph memory.");
c("genai.knowledge_memory.memory.task_memory", "Task Memory", "Concept",
  "Plans, intermediate artifacts, and tool outputs retained during task execution.");
c("genai.knowledge_memory.memory.personalization", "Personalization Memory", "Concept",
  "User preferences stored with consent and policy controls.");
c("genai.knowledge_memory.memory.governance", "Memory Governance", "Concept",
  "Retention policies, right to be forgotten, privacy boundaries, redaction.");

e("genai.knowledge_memory", "genai.knowledge_memory.memory", "PART_OF");
for (const sub of ["short_term","long_term","task_memory","personalization","governance"])
  e("genai.knowledge_memory.memory", `genai.knowledge_memory.memory.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.5 AGENTS, TOOL USE & PROTOCOLS
// ─────────────────────────────────────────────

// Agent architectures
c("genai.agents_tools.architectures", "Agent Architectures", "Concept",
  "Conceptual patterns for how agents reason, plan, and act.");
c("genai.agents_tools.architectures.reactive", "Reactive Agents", "Pattern",
  "Single-step tool calls without planning; simplest agent pattern.");
c("genai.agents_tools.architectures.plan_execute", "Plan-and-Execute Agents", "Pattern",
  "Create a plan first, then execute steps sequentially.");
c("genai.agents_tools.architectures.react", "ReAct-style Agents", "Pattern",
  "Interleave thought + action + observation in a loop.");
c("genai.agents_tools.architectures.reflection", "Reflection / Critique Loops", "Pattern",
  "Agent reviews its own outputs and iterates for improvement.");
c("genai.agents_tools.architectures.multi_agent", "Multi-agent Systems", "Pattern",
  "Multiple specialist agents coordinated by an orchestrator.",
  ["Introduces new attack surfaces for agent-to-agent spoofing"]);
c("genai.agents_tools.architectures.tool_augmented", "Tool-augmented Reasoning", "Pattern",
  "Code interpreter, DB query, web search, etc. as reasoning tools.");
c("genai.agents_tools.architectures.sandboxed", "Sandboxed Execution", "Pattern",
  "Run agent tool calls in isolated sandboxes for security.");

e("genai.agents_tools", "genai.agents_tools.architectures", "PART_OF");
for (const sub of ["reactive","plan_execute","react","reflection","multi_agent","tool_augmented","sandboxed"])
  e("genai.agents_tools.architectures", `genai.agents_tools.architectures.${sub}`, "PART_OF");

// Tooling primitives
c("genai.agents_tools.primitives", "Tooling Primitives", "Concept",
  "Core building blocks for tool use: function calling, routing, validation.");
c("genai.agents_tools.primitives.function_calling", "Function Calling / Structured Invocation", "Concept",
  "Model outputs structured tool calls with name and arguments.");
c("genai.agents_tools.primitives.tool_routers", "Tool Routers", "Concept",
  "Decide whether to call a tool or answer directly.");
c("genai.agents_tools.primitives.tool_validation", "Tool Result Validation", "Concept",
  "Validate tool outputs against schemas and type checks.");
c("genai.agents_tools.primitives.idempotency", "Idempotency & Retries", "Concept",
  "Ensure tool calls can be safely retried without side effects.");
c("genai.agents_tools.primitives.side_effect_controls", "Side-effect Controls", "Concept",
  "Approve/deny gates for tool calls that modify external state.");

e("genai.agents_tools", "genai.agents_tools.primitives", "PART_OF");
for (const sub of ["function_calling","tool_routers","tool_validation","idempotency","side_effect_controls"])
  e("genai.agents_tools.primitives", `genai.agents_tools.primitives.${sub}`, "PART_OF");

// Protocols
c("genai.agents_tools.protocols", "Interoperability Protocols", "Concept",
  "Standards for connecting LLM apps to tools, data, and other agents.");
c("genai.agents_tools.protocols.mcp", "Model Context Protocol (MCP)", "Protocol",
  "A protocol for connecting LLM applications to external tools and data sources.",
  ["Treat tool chains as security-sensitive", "Schemas + validation help prevent unsafe tool use"]);
c("genai.agents_tools.protocols.a2a", "Agent2Agent (A2A)", "Protocol",
  "A protocol for agent-to-agent interoperability and coordination.",
  ["Requires authn/authz and message integrity", "Adds a new attack surface for spoofing and injection"]);
c("genai.agents_tools.protocols.langchain_agent", "LangChain Agent Protocol", "Protocol",
  "Framework-agnostic APIs for serving agents in production.");
c("genai.agents_tools.protocols.activity_protocol", "Activity Protocol (Microsoft Agents SDK)", "Protocol",
  "Standardizes activity messages between agents, users, and channels.");
c("genai.agents_tools.protocols.activitypub", "W3C ActivityPub / ActivityStreams 2.0", "Standard",
  "Federated publish/subscribe for agent actions; enables 'agentic web' concepts.");

e("genai.agents_tools", "genai.agents_tools.protocols", "PART_OF");
for (const sub of ["mcp","a2a","langchain_agent","activity_protocol","activitypub"])
  e("genai.agents_tools.protocols", `genai.agents_tools.protocols.${sub}`, "PART_OF");

// Agent safety
c("genai.agents_tools.safety", "Agent Safety & Controls", "Concept",
  "Security controls specific to agentic systems.");
c("genai.agents_tools.safety.tool_permissioning", "Tool Permissioning (Capability-based)", "Control",
  "Capability-based access control for tool invocation.");
c("genai.agents_tools.safety.human_approval", "Human Approval for Side Effects", "Control",
  "Require human confirmation before executing state-changing tool calls.");
c("genai.agents_tools.safety.output_constraints", "Output Constraints (Schemas)", "Control",
  "Force structured outputs to prevent arbitrary code/text injection.");
c("genai.agents_tools.safety.prompt_firewalling", "Prompt Firewalling / Instruction Hierarchy", "Control",
  "Separate system/user/tool instructions with enforced priority levels.");
c("genai.agents_tools.safety.tool_input_sanitization", "Tool Input Sanitization", "Control",
  "Sanitize retrieved text before passing to tools to prevent injection.");

e("genai.agents_tools", "genai.agents_tools.safety", "PART_OF");
for (const sub of ["tool_permissioning","human_approval","output_constraints","prompt_firewalling","tool_input_sanitization"])
  e("genai.agents_tools.safety", `genai.agents_tools.safety.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.6 EVALUATION, OBSERVABILITY & LLMOPS
// ─────────────────────────────────────────────

// Eval types
c("genai.llmops.evals", "Evaluation Types", "Concept",
  "Offline, online, and dimension-specific evaluation of LLM systems.");
c("genai.llmops.evals.offline", "Offline Evals", "Concept",
  "Pre-deployment evaluation on curated and synthetic test sets.");
c("genai.llmops.evals.offline.golden_sets", "Golden Sets", "Artifact",
  "Curated human-labeled test cases for regression and quality measurement.");
c("genai.llmops.evals.offline.synthetic_gen", "Synthetic Test Generation", "Method",
  "Auto-generate test cases with LLMs + human review for coverage.");
c("genai.llmops.evals.offline.regression", "Regression Tests", "Artifact",
  "Prompt + expected property assertions to catch quality regressions.");
c("genai.llmops.evals.online", "Online Evals", "Concept",
  "In-production evaluation via experiments and user feedback.");
c("genai.llmops.evals.online.ab_tests", "A/B Tests for Prompts/Models", "Method",
  "Compare prompt or model variants in production with real users.");
c("genai.llmops.evals.online.canary_rollout", "Canary & Gradual Rollout", "Method",
  "Deploy changes to a small percentage of traffic first, then expand.");
c("genai.llmops.evals.online.human_feedback", "Human Feedback Loops", "Method",
  "Thumbs up/down, issue tags, and other inline user feedback.");

c("genai.llmops.evals.dimensions", "Eval Dimensions", "Concept",
  "What to measure: quality, safety, security, reliability, latency, grounding.");
c("genai.llmops.evals.dimensions.quality", "Quality: Helpfulness & Correctness", "Metric",
  "Does the output actually help the user and contain correct information?");
c("genai.llmops.evals.dimensions.safety", "Safety: Policy Compliance", "Metric",
  "Does the output comply with content policies and avoid harm?");
c("genai.llmops.evals.dimensions.security", "Security: Injection Resistance", "Metric",
  "Can the system resist prompt injection and data exfiltration attempts?");
c("genai.llmops.evals.dimensions.reliability", "Reliability: Tool Success Rate", "Metric",
  "Tool call success rates, retry rates, and overall system reliability.");
c("genai.llmops.evals.dimensions.latency_cost", "Latency & Cost", "Metric",
  "Tokens consumed, time-to-first-token, end-to-end latency, cost per query.");
c("genai.llmops.evals.dimensions.grounding", "Grounding: Citation Precision/Recall", "Metric",
  "Are citations accurate and do they cover all claims?");

c("genai.llmops.evals.agents", "Evals for Agents", "Concept",
  "Agent-specific evaluation challenges: tool use, planning, side effects, memory.");
c("genai.llmops.evals.agents.tool_correctness", "Tool-use Correctness Eval", "Metric",
  "Did the agent call the right tool with correct arguments?");
c("genai.llmops.evals.agents.planning_stability", "Planning Stability Eval", "Metric",
  "Does the agent avoid loops, dead ends, and unnecessary retries?");
c("genai.llmops.evals.agents.side_effect_safety", "Side-effect Safety Checks", "Metric",
  "Did the agent avoid unintended mutations or dangerous actions?");
c("genai.llmops.evals.agents.memory_correctness", "Stateful Memory Correctness", "Metric",
  "Does the agent correctly maintain and use stateful memory across turns?");

e("genai.llmops", "genai.llmops.evals", "PART_OF");
e("genai.llmops.evals", "genai.llmops.evals.offline", "PART_OF");
e("genai.llmops.evals", "genai.llmops.evals.online", "PART_OF");
e("genai.llmops.evals", "genai.llmops.evals.dimensions", "PART_OF");
e("genai.llmops.evals", "genai.llmops.evals.agents", "PART_OF");
for (const sub of ["golden_sets","synthetic_gen","regression"])
  e("genai.llmops.evals.offline", `genai.llmops.evals.offline.${sub}`, "PART_OF");
for (const sub of ["ab_tests","canary_rollout","human_feedback"])
  e("genai.llmops.evals.online", `genai.llmops.evals.online.${sub}`, "PART_OF");
for (const sub of ["quality","safety","security","reliability","latency_cost","grounding"])
  e("genai.llmops.evals.dimensions", `genai.llmops.evals.dimensions.${sub}`, "PART_OF");
for (const sub of ["tool_correctness","planning_stability","side_effect_safety","memory_correctness"])
  e("genai.llmops.evals.agents", `genai.llmops.evals.agents.${sub}`, "PART_OF");

// Observability
c("genai.llmops.observability", "Observability & Instrumentation", "Concept",
  "Tracing, metrics, and events for LLM systems.");
c("genai.llmops.observability.opentelemetry.genai", "OpenTelemetry GenAI Semantic Conventions", "Standard",
  "Tracing/metrics conventions for GenAI systems (prompts, responses, tool calls, retrieval, and agent steps).",
  ["Enables auditability and incident response",
   "Instrument prompt, tool, and retrieval traces carefully to avoid PII leakage"]);
c("genai.llmops.observability.prompt_response", "Prompt + Response Metadata", "Concept",
  "Log prompt templates, response content (with PII care), and metadata.");
c("genai.llmops.observability.token_counts", "Token Counts & Model Info", "Concept",
  "Track token usage, model name/version for cost and performance analysis.");
c("genai.llmops.observability.tool_call_traces", "Tool Call Traces", "Concept",
  "Trace each tool invocation with arguments, latency, and results.");
c("genai.llmops.observability.retrieval_traces", "Retrieval Traces", "Concept",
  "Log queries, retrieved doc IDs, ranks, and relevance scores.");
c("genai.llmops.observability.safety_filter_actions", "Safety Filter Actions", "Concept",
  "Record when safety filters trigger: what was blocked and why.");
c("genai.llmops.observability.cache_hits", "Caching Hits/Misses", "Concept",
  "Track prompt cache and KV cache utilization.");

e("genai.llmops", "genai.llmops.observability", "PART_OF");
e("genai.llmops.observability", "genai.llmops.observability.opentelemetry.genai", "PART_OF");
for (const sub of ["prompt_response","token_counts","tool_call_traces","retrieval_traces","safety_filter_actions","cache_hits"])
  e("genai.llmops.observability", `genai.llmops.observability.${sub}`, "PART_OF");

// LLMOps stack
c("genai.llmops.stack", "LLMOps Stack", "Concept",
  "Tool-agnostic components of an LLM operations platform.");
c("genai.llmops.stack.tracing_backend", "Tracing Backend", "Tool",
  "Backend for storing and querying distributed traces (e.g., Jaeger, Tempo).");
c("genai.llmops.stack.eval_harness", "Eval Harness", "Tool",
  "Framework for running evaluation suites and tracking results over time.");
c("genai.llmops.stack.prompt_registry", "Prompt Registry", "Tool",
  "Version-controlled store for prompt templates and system prompts.");
c("genai.llmops.stack.model_registry", "Model Registry", "Tool",
  "Track model versions, metadata, and deployment status.");
c("genai.llmops.stack.dataset_store", "Dataset / Version Store", "Tool",
  "Versioned storage for training, eval, and test datasets.");
c("genai.llmops.stack.policy_config", "Policy / Guardrail Config", "Tool",
  "Configuration store for safety policies and guardrail rules.");

e("genai.llmops", "genai.llmops.stack", "PART_OF");
for (const sub of ["tracing_backend","eval_harness","prompt_registry","model_registry","dataset_store","policy_config"])
  e("genai.llmops.stack", `genai.llmops.stack.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.7 INFERENCE, SERVING, HARDWARE & SYSTEMS
// ─────────────────────────────────────────────

// Inference optimization
c("genai.systems_inference.optimization", "Inference Optimization", "Concept",
  "Techniques to make LLM inference faster and more memory-efficient.");
c("genai.systems_inference.kvcache.kv_cache", "KV Cache", "Concept",
  "Key/value tensors cached during autoregressive decoding to avoid recomputing attention.",
  ["Speeds up decoding", "Stores keys and values per layer"]);
c("genai.systems_inference.optimization.continuous_batching", "Continuous / Dynamic Batching", "Method",
  "Add new requests to a running batch without waiting for all to finish.");
c("genai.systems_inference.optimization.speculative_decoding", "Speculative Decoding", "Method",
  "Use a small draft model to propose tokens; verify in parallel with the large model.");
c("genai.systems_inference.optimization.prefix_caching", "Prefix / Prompt Caching", "Method",
  "Cache KV states for common prompt prefixes to avoid redundant computation.");
c("genai.systems_inference.optimization.quantization", "Quantization", "Method",
  "Reduce precision of weights and/or KV cache to lower memory and compute requirements.",
  ["INT8, INT4, FP8 formats", "Weight-only vs weight+activation quantization"]);
c("genai.systems_inference.optimization.compilation", "Compilation / Kernel Fusion", "Method",
  "Compile model graphs and fuse operations for hardware-specific optimization.");

e("genai.systems_inference", "genai.systems_inference.optimization", "PART_OF");
for (const sub of ["continuous_batching","speculative_decoding","prefix_caching","quantization","compilation"])
  e("genai.systems_inference.optimization", `genai.systems_inference.optimization.${sub}`, "PART_OF");

// Attention efficiency
c("genai.systems_inference.attention.flashattention", "FlashAttention", "Method",
  "An IO-aware exact attention kernel that improves attention throughput by reducing memory reads/writes.",
  ["Training and inference speedups", "Often paired with long-context serving"]);
c("genai.systems_inference.kvcache.pagedattention", "PagedAttention", "Method",
  "Paging-inspired memory management for KV cache that reduces fragmentation and waste.",
  ["Core innovation behind vLLM", "Enables efficient continuous batching"]);

e("genai.systems_inference", "genai.systems_inference.kvcache.kv_cache", "PART_OF");
e("genai.systems_inference", "genai.systems_inference.attention.flashattention", "PART_OF");
e("genai.systems_inference", "genai.systems_inference.kvcache.pagedattention", "PART_OF");

// Serving
c("genai.systems_inference.serving.vllm", "vLLM", "Tool",
  "An LLM serving system focused on high-throughput inference; popularized PagedAttention for KV cache management.",
  ["Continuous batching", "KV cache paging reduces fragmentation and waste"]);
e("genai.systems_inference", "genai.systems_inference.serving.vllm", "PART_OF");

// Parallelism
c("genai.systems_inference.parallelism", "Parallelism & Distributed Serving", "Concept",
  "Strategies for distributing model inference across multiple devices.");
c("genai.systems_inference.parallelism.tensor", "Tensor Parallelism", "Method",
  "Split individual layers across devices for intra-layer parallelism.");
c("genai.systems_inference.parallelism.pipeline", "Pipeline Parallelism", "Method",
  "Split model layers across devices for inter-layer parallelism.");
c("genai.systems_inference.parallelism.expert", "Expert Parallelism", "Method",
  "Distribute MoE experts across devices; requires careful load balancing.");
c("genai.systems_inference.parallelism.data_parallel", "Data Parallel Inference", "Method",
  "Run model replicas on different devices for throughput scaling.");
c("genai.systems_inference.parallelism.interconnect", "High-speed Interconnect (NCCL, InfiniBand)", "Concept",
  "Low-latency networking crucial for distributed inference performance.");

e("genai.systems_inference", "genai.systems_inference.parallelism", "PART_OF");
for (const sub of ["tensor","pipeline","expert","data_parallel","interconnect"])
  e("genai.systems_inference.parallelism", `genai.systems_inference.parallelism.${sub}`, "PART_OF");

// Hardware
c("genai.systems_inference.hardware", "Hardware Concepts", "Concept",
  "Compute hardware architectures and constraints for AI inference.");
c("genai.systems_inference.hardware.gpu_tpu_npu", "GPU / TPU / NPU Architectures", "Concept",
  "Accelerator architectures optimized for matrix operations and AI workloads.");
c("genai.systems_inference.hardware.memory_hierarchy", "Memory Hierarchy (HBM, SRAM, Cache)", "Concept",
  "Memory tiers determine data movement costs; critical for attention kernel design.");
c("genai.systems_inference.hardware.bandwidth_flops", "Bandwidth vs FLOPs Bottlenecks", "Concept",
  "Most LLM inference is memory-bandwidth-bound, not compute-bound.");
c("genai.systems_inference.hardware.multi_node", "Multi-node Networking", "Concept",
  "InfiniBand and high-speed Ethernet for multi-node training and inference.");
c("genai.systems_inference.hardware.edge_constraints", "Edge Hardware Constraints", "Concept",
  "Battery, thermal, and memory limits for on-device AI.");

e("genai.systems_inference", "genai.systems_inference.hardware", "PART_OF");
for (const sub of ["gpu_tpu_npu","memory_hierarchy","bandwidth_flops","multi_node","edge_constraints"])
  e("genai.systems_inference.hardware", `genai.systems_inference.hardware.${sub}`, "PART_OF");

// Deployment modes
c("genai.systems_inference.deployment", "Deployment Modes", "Concept",
  "Where and how models are served in production.");
c("genai.systems_inference.deployment.cloud", "Cloud Serving", "Pattern",
  "Serve models in cloud data centers for scalability and cost efficiency.");
c("genai.systems_inference.deployment.on_prem", "On-premises Serving", "Pattern",
  "Serve models on owned infrastructure for data sovereignty and compliance.");
c("genai.systems_inference.deployment.edge_device", "Edge / On-device Serving", "Pattern",
  "Run models directly on user devices for privacy and low latency.");
c("genai.systems_inference.deployment.hybrid", "Hybrid Deployment", "Pattern",
  "Split compute between cloud and edge; local retrieval with cloud inference.");

e("genai.systems_inference", "genai.systems_inference.deployment", "PART_OF");
for (const sub of ["cloud","on_prem","edge_device","hybrid"])
  e("genai.systems_inference.deployment", `genai.systems_inference.deployment.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.8 SECURITY, SAFETY, RED TEAMING
// ─────────────────────────────────────────────

// Threat taxonomy
c("genai.security_safety.owasp_llm_top_10", "OWASP Top 10 for LLM Applications", "Benchmark",
  "A practical taxonomy of common LLM application risks (prompt injection, insecure output handling, data poisoning, etc.).");
c("genai.security_safety.prompt_injection.direct", "Direct Prompt Injection", "Threat",
  "Attacker directly crafts input to override system instructions.");
c("genai.security_safety.prompt_injection.indirect", "Indirect Prompt Injection", "Threat",
  "Untrusted retrieved content (docs/web) contains instructions that the model mistakenly follows.",
  ["Often targets agentic RAG and tool use", "Can lead to data exfiltration or unsafe side effects"]);
c("genai.security_safety.data_exfiltration", "Data Exfiltration", "Threat",
  "Extracting sensitive data via tool calls, retrieval manipulation, or memory access.");
c("genai.security_safety.tool_abuse", "Tool Abuse", "Threat",
  "Manipulating the model into making unapproved or harmful tool calls.");
c("genai.security_safety.model_extraction", "Model Extraction / Distillation Attacks", "Threat",
  "Stealing model weights or capabilities through systematic querying; also a policy/legal concern.");
c("genai.security_safety.data_poisoning", "Training Data Poisoning", "Threat",
  "Injecting malicious data into training sets to create backdoors or degrade quality.");
c("genai.security_safety.supply_chain", "Supply Chain Vulnerabilities", "Threat",
  "Compromised models, dependencies, MCP servers, or plugins in the deployment pipeline.");
c("genai.security_safety.sensitive_disclosure", "Sensitive Info Disclosure", "Threat",
  "PII, secrets, or internal data leaked in model outputs or logs.");
c("genai.security_safety.jailbreaks", "Jailbreaks / Policy Evasion", "Threat",
  "Techniques to bypass safety training and content policies.");
c("genai.security_safety.denial_of_wallet", "Denial of Wallet", "Threat",
  "Cost amplification attacks that drain API budgets via expensive queries.");
c("genai.security_safety.multi_agent_attacks", "Multi-agent Attack Surfaces", "Threat",
  "Agent-to-agent spoofing, message injection, and coordination manipulation.");

for (const t of ["prompt_injection.direct","prompt_injection.indirect","data_exfiltration","tool_abuse","model_extraction","data_poisoning","supply_chain","sensitive_disclosure","jailbreaks","denial_of_wallet","multi_agent_attacks"])
  e("genai.security_safety", `genai.security_safety.${t}`, "PART_OF");

// Controls
c("genai.security_safety.controls.retrieval_sanitization", "Retrieval Sanitization", "Control",
  "Mitigations that reduce instruction-following from retrieved content (e.g. strip instructions, separate data/instructions).");
c("genai.security_safety.controls.tool_allowlist", "Tool Allowlist", "Control",
  "Deny-by-default tool access: only permit explicitly approved tools and scoped operations.");
c("genai.security_safety.controls.least_privilege", "Least Privilege", "Control",
  "Grant the minimum capabilities needed for a tool invocation (scoped tokens, short lifetimes, limited resources).");
c("genai.security_safety.controls.sandboxed_execution", "Sandboxed Execution", "Control",
  "Run code, shell commands, and file operations in isolated containers.");
c("genai.security_safety.controls.structured_outputs", "Structured Outputs + Strict Parsing", "Control",
  "JSON schema validation on model outputs to prevent arbitrary content injection.");
c("genai.security_safety.controls.io_filtering", "Input/Output Filtering", "Control",
  "Policy-based and PII filtering on inputs and outputs.");
c("genai.security_safety.controls.rate_limits", "Rate Limits, Cost Guards, Timeouts", "Control",
  "Prevent abuse and cost overruns via rate limiting and budget controls.");
c("genai.security_safety.controls.provenance_signing", "Provenance & Signing", "Control",
  "Cryptographic signing and provenance tracking for tool servers and model artifacts.");
c("genai.security_safety.controls.monitoring_alerting", "Monitoring + Alerting", "Control",
  "Real-time detection of anomalous patterns, policy violations, and attacks.");

for (const ctrl of ["retrieval_sanitization","tool_allowlist","least_privilege","sandboxed_execution","structured_outputs","io_filtering","rate_limits","provenance_signing","monitoring_alerting"])
  e("genai.security_safety", `genai.security_safety.controls.${ctrl}`, "PART_OF");

// Red teaming
c("genai.security_safety.red_teaming", "Red Teaming", "Concept",
  "Structured adversarial testing of AI systems to find vulnerabilities and failure modes.");
c("genai.security_safety.red_teaming.methodology", "Red Teaming Methodology & Playbooks", "Artifact",
  "Government and industry playbooks for structured AI red teaming exercises.");
c("genai.security_safety.red_teaming.offensive_eval", "Offensive Security Capability Eval", "Method",
  "Evaluate models' ability to assist with vulnerability research and exploitation.");
c("genai.security_safety.red_teaming.project_naptime", "Project Naptime", "Method",
  "LLM-assisted vulnerability research; frontier node for offensive AI capabilities.");

e("genai.security_safety", "genai.security_safety.red_teaming", "PART_OF");
for (const sub of ["methodology","offensive_eval","project_naptime"])
  e("genai.security_safety.red_teaming", `genai.security_safety.red_teaming.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.9 GOVERNANCE, RISK & COMPLIANCE
// ─────────────────────────────────────────────

c("genai.governance.frameworks", "Risk Management Frameworks", "Concept",
  "Structured approaches to identifying and managing AI risks.");
c("genai.governance.frameworks.nist_ai_rmf", "NIST AI RMF 1.0", "Standard",
  "A risk management framework for AI systems: govern, map, measure, manage.");
c("genai.governance.frameworks.iso_42001", "ISO/IEC 42001:2023", "Standard",
  "International standard for AI management systems; certifiable framework.");

e("genai.governance", "genai.governance.frameworks", "PART_OF");
e("genai.governance.frameworks", "genai.governance.frameworks.nist_ai_rmf", "PART_OF");
e("genai.governance.frameworks", "genai.governance.frameworks.iso_42001", "PART_OF");

c("genai.governance.regulation", "Regulation", "Concept",
  "Legal and regulatory requirements for AI systems.");
c("genai.governance.regulation.eu_ai_act", "EU AI Act", "Regulation",
  "EU regulation classifying AI systems by risk level with obligations for high-risk and GPAI.",
  ["Phased implementation timeline", "Requires conformity assessments for high-risk AI"]);

e("genai.governance", "genai.governance.regulation", "PART_OF");
e("genai.governance.regulation", "genai.governance.regulation.eu_ai_act", "PART_OF");

c("genai.governance.principles", "Responsible AI Principles", "Concept",
  "Organization-level ethical guidelines and policy frameworks for AI.");
c("genai.governance.principles.microsoft_rai", "Microsoft Responsible AI Standard", "Standard",
  "Microsoft's principles + Responsible AI Standard as policy/process anchors.");
c("genai.governance.principles.google_ai", "Google AI Principles / SAIF", "Standard",
  "Google's AI principles and Secure AI Framework (SAIF) for responsible deployment.");

e("genai.governance", "genai.governance.principles", "PART_OF");
e("genai.governance.principles", "genai.governance.principles.microsoft_rai", "PART_OF");
e("genai.governance.principles", "genai.governance.principles.google_ai", "PART_OF");

c("genai.governance.artifacts", "Governance Artifacts", "Concept",
  "Documents and processes that operationalize AI governance.");
c("genai.governance.artifacts.model_cards", "Model Cards / System Cards", "Artifact",
  "Structured documentation of model capabilities, limitations, and intended uses.");
c("genai.governance.artifacts.datasheets", "Datasheets for Datasets", "Artifact",
  "Documentation of dataset provenance, composition, and intended uses.");
c("genai.governance.artifacts.risk_assessments", "Risk Assessments (DPIA-like)", "Artifact",
  "Systematic evaluation of AI system risks and impacts.");
c("genai.governance.artifacts.incident_response", "Incident Response Runbooks", "Artifact",
  "Procedures for handling AI system failures and security incidents.");
c("genai.governance.artifacts.human_oversight", "Human Oversight Procedures", "Artifact",
  "Processes ensuring meaningful human review of AI decisions.");
c("genai.governance.artifacts.audit_logs", "Audit Logs & Trace Retention", "Artifact",
  "Policies for retaining traces, decisions, and actions for accountability.");
c("genai.governance.artifacts.access_control", "Access Control Policies", "Artifact",
  "Policies governing who can access memory, retrieval data, and model outputs.");
c("genai.governance.artifacts.vendor_risk", "Third-party Vendor Risk Reviews", "Artifact",
  "Assessment processes for AI vendors, model providers, and tool integrations.");

e("genai.governance", "genai.governance.artifacts", "PART_OF");
for (const sub of ["model_cards","datasheets","risk_assessments","incident_response","human_oversight","audit_logs","access_control","vendor_risk"])
  e("genai.governance.artifacts", `genai.governance.artifacts.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.10 AI UX/UI & PRODUCT DESIGN
// ─────────────────────────────────────────────

c("genai.product_design.hai_foundations", "Human-AI Interaction Foundations", "Concept",
  "Research-grounded guidelines for designing effective human-AI experiences.");
c("genai.product_design.hai_foundations.ms_18_guidelines", "Guidelines for Human-AI Interaction (18 Guidelines)", "Standard",
  "Microsoft's 18 guidelines for human-AI interaction; canonical UX anchor.");
c("genai.product_design.hai_foundations.google_pair", "Google PAIR People + AI Guidebook", "Standard",
  "Practical product/UX guidebook for designing AI-powered applications.");

e("genai.product_design", "genai.product_design.hai_foundations", "PART_OF");
e("genai.product_design.hai_foundations", "genai.product_design.hai_foundations.ms_18_guidelines", "PART_OF");
e("genai.product_design.hai_foundations", "genai.product_design.hai_foundations.google_pair", "PART_OF");

c("genai.product_design.ux_concepts", "AI UX Concepts", "Concept",
  "Key UX dimensions for AI products: trust, transparency, control, feedback.");
c("genai.product_design.ux_concepts.trust_calibration", "Trust Calibration", "Concept",
  "Help users develop appropriate trust levels—avoid both overtrust and undertrust.");
c("genai.product_design.ux_concepts.transparency", "Transparency & Explainability", "Concept",
  "Communicate what the AI does, why, and what its limits are.");
c("genai.product_design.ux_concepts.uncertainty_comm", "Uncertainty Communication", "Concept",
  "Show confidence levels, citations, and caveats to support informed decisions.");
c("genai.product_design.ux_concepts.error_recovery", "Error Recovery", "Concept",
  "Undo, regenerate, refine—give users tools to recover from AI mistakes.");
c("genai.product_design.ux_concepts.user_control", "User Control", "Concept",
  "Editable drafts, sliders, constraints—let users shape AI behavior.");
c("genai.product_design.ux_concepts.feedback_capture", "Feedback Capture", "Concept",
  "Inline ratings, reason codes, and other mechanisms for collecting user feedback.");
c("genai.product_design.ux_concepts.safety_ux", "Safety UX", "Concept",
  "Refusals that are helpful, offer safe alternatives, and explain why.");
c("genai.product_design.ux_concepts.privacy_ux", "Privacy UX", "Concept",
  "Memory controls, data usage disclosures, and consent management.");

e("genai.product_design", "genai.product_design.ux_concepts", "PART_OF");
for (const sub of ["trust_calibration","transparency","uncertainty_comm","error_recovery","user_control","feedback_capture","safety_ux","privacy_ux"])
  e("genai.product_design.ux_concepts", `genai.product_design.ux_concepts.${sub}`, "PART_OF");

// UI patterns
c("genai.product_design.ui_patterns", "AI UI Patterns", "Concept",
  "High-leverage UI patterns for AI-powered applications.");
c("genai.product_design.ui_patterns.chat", "Chat UI", "Pattern",
  "Conversational interface; the default GenAI interaction pattern.");
c("genai.product_design.ui_patterns.copilot", "Copilot UI", "Pattern",
  "Inline suggestions in the user's working context (IDE, editor, etc.).");
c("genai.product_design.ui_patterns.canvas", "Canvas UI", "Pattern",
  "Co-editing interface for structured artifacts (documents, diagrams).");
c("genai.product_design.ui_patterns.agent", "Agent UI", "Pattern",
  "Task list + execution trace + approval gates for autonomous agents.");
c("genai.product_design.ui_patterns.plan_act_review", "Plan / Act / Review UI", "Pattern",
  "Explicit stages: show the plan, execute, then review results.");
c("genai.product_design.ui_patterns.retrieval", "Retrieval UI", "Pattern",
  "Citations, source viewer, quote highlighting for RAG applications.");
c("genai.product_design.ui_patterns.tool_execution", "Tool Execution UI", "Pattern",
  "Dry-run preview, diffs, and confirmations for tool-using agents.");
c("genai.product_design.ui_patterns.memory_ui", "Memory UI", "Pattern",
  "View, edit, and delete what the AI remembers about the user.");

e("genai.product_design", "genai.product_design.ui_patterns", "PART_OF");
for (const sub of ["chat","copilot","canvas","agent","plan_act_review","retrieval","tool_execution","memory_ui"])
  e("genai.product_design.ui_patterns", `genai.product_design.ui_patterns.${sub}`, "PART_OF");

// Product design patterns
c("genai.product_design.product_patterns", "AI Product Design Patterns", "Concept",
  "System-level patterns for building reliable AI products.");
c("genai.product_design.product_patterns.hitl", "Human-in-the-loop Approval", "Pattern",
  "Require human approval gates for side effects and high-stakes decisions.");
c("genai.product_design.product_patterns.policy_first", "Policy-first Requirements", "Pattern",
  "Define safety acceptance criteria before building features.");
c("genai.product_design.product_patterns.eval_driven", "Eval-driven Development", "Pattern",
  "Block shipping on eval thresholds; CI/CD gates on quality metrics.");
c("genai.product_design.product_patterns.fallback_degrade", "Fallback & Degrade Gracefully", "Pattern",
  "Fall back to smaller model, retrieval-only, or safe refusal when primary path fails.");
c("genai.product_design.product_patterns.multi_model_routing", "Multi-model Routing", "Pattern",
  "Route easy tasks to cheap models and hard tasks to reasoning models.");
c("genai.product_design.product_patterns.data_flywheel_integration", "Data Flywheel Integration", "Pattern",
  "Wire telemetry → evals → improvements into the product development cycle.");

e("genai.product_design", "genai.product_design.product_patterns", "PART_OF");
for (const sub of ["hitl","policy_first","eval_driven","fallback_degrade","multi_model_routing","data_flywheel_integration"])
  e("genai.product_design.product_patterns", `genai.product_design.product_patterns.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 2.11 ADAPTIVE SYSTEMS & DATA FLYWHEELS
// ─────────────────────────────────────────────

c("genai.adaptive_flywheels.data_flywheel", "Data Flywheel", "Concept",
  "Instrumentation → data → evaluation → improvements → better product → more usage → more data.",
  ["Safety constraints: avoid reinforcing bias or collecting sensitive data",
   "Governance hooks: consent, retention, minimization"]);
c("genai.adaptive_flywheels.adaptation", "Adaptation Mechanisms", "Concept",
  "Ways AI systems improve and personalize over time.");
c("genai.adaptive_flywheels.adaptation.personalization", "Personalization", "Method",
  "Adapt to users via explicit preferences and implicit behavioral signals.");
c("genai.adaptive_flywheels.adaptation.bandits_rl", "Bandits / RL at Product Layer", "Method",
  "Use bandit algorithms or RL for ranking, suggestions, and content selection.");
c("genai.adaptive_flywheels.adaptation.continual_learning", "Continual Learning (Offline)", "Method",
  "Periodically retrain or update models on new data in controlled offline cycles.");
c("genai.adaptive_flywheels.adaptation.online_learning", "Online Learning", "Method",
  "Update models in real-time from production data; rare in high-risk settings.");
c("genai.adaptive_flywheels.adaptation.prompt_adaptation", "Prompt Adaptation", "Method",
  "Dynamically adjust system prompts based on context, with policy constraints.");

e("genai.adaptive_flywheels", "genai.adaptive_flywheels.data_flywheel", "PART_OF");
e("genai.adaptive_flywheels", "genai.adaptive_flywheels.adaptation", "PART_OF");
for (const sub of ["personalization","bandits_rl","continual_learning","online_learning","prompt_adaptation"])
  e("genai.adaptive_flywheels.adaptation", `genai.adaptive_flywheels.adaptation.${sub}`, "PART_OF");

// Failure modes
c("genai.adaptive_flywheels.failure_modes", "Flywheel Failure Modes", "Concept",
  "Ways data flywheels can go wrong and amplify harm.");
c("genai.adaptive_flywheels.failure_modes.bias_amplification", "Feedback Loops Amplifying Bias", "Threat",
  "Self-reinforcing cycles that amplify existing biases in data and behavior.");
c("genai.adaptive_flywheels.failure_modes.reward_hacking", "Reward Hacking", "Threat",
  "Optimizing proxy metrics while degrading actual user value.");
c("genai.adaptive_flywheels.failure_modes.distribution_shift", "Distribution Shift / Concept Drift", "Threat",
  "Model performance degrades as real-world data distribution changes over time.");
c("genai.adaptive_flywheels.failure_modes.poisoning_feedback", "Data Poisoning via Feedback", "Threat",
  "Adversaries inject harmful feedback to corrupt the flywheel.");

e("genai.adaptive_flywheels", "genai.adaptive_flywheels.failure_modes", "PART_OF");
for (const sub of ["bias_amplification","reward_hacking","distribution_shift","poisoning_feedback"])
  e("genai.adaptive_flywheels.failure_modes", `genai.adaptive_flywheels.failure_modes.${sub}`, "PART_OF");

// ─────────────────────────────────────────────
// 3) CROSS-DOMAIN EDGES
// ─────────────────────────────────────────────

// Protocol/tooling ↔ security
e("genai.agents_tools.protocols.mcp", "genai.agents_tools", "ENABLES");
e("genai.agents_tools.protocols.mcp", "genai.security_safety.supply_chain", "ATTACKED_BY");
e("genai.agents_tools.protocols.mcp", "genai.security_safety.prompt_injection.indirect", "ATTACKED_BY");
e("genai.agents_tools.protocols.mcp", "genai.security_safety.controls.tool_allowlist", "REQUIRES");
e("genai.agents_tools.protocols.mcp", "genai.security_safety.controls.least_privilege", "REQUIRES");
e("genai.agents_tools.protocols.a2a", "genai.agents_tools.architectures.multi_agent", "ENABLES");
e("genai.agents_tools.protocols.a2a", "genai.security_safety.controls.rate_limits", "REQUIRES");
e("genai.agents_tools.protocols.a2a", "genai.security_safety.multi_agent_attacks", "ATTACKED_BY");

// Retrieval ↔ safety
e("genai.knowledge_memory.rag", "genai.foundations.problem_families.factuality", "MITIGATED_BY");
e("genai.knowledge_memory.rag", "genai.security_safety.prompt_injection.indirect", "ATTACKED_BY");
e("genai.knowledge_memory.rag", "genai.security_safety.controls.retrieval_sanitization", "MITIGATED_BY");
e("genai.knowledge_memory.rag.graphrag", "genai.knowledge_memory.graph.entity_resolution", "DEPENDS_ON");
e("genai.knowledge_memory.rag.graphrag", "genai.knowledge_memory.graph.entity_extraction", "DEPENDS_ON");

// Inference systems ↔ architecture
e("genai.systems_inference.attention.flashattention", "genai.systems_inference.hardware.memory_hierarchy", "OPTIMIZED_BY");
e("genai.systems_inference.kvcache.pagedattention", "genai.systems_inference.kvcache.kv_cache", "OPTIMIZED_BY");
e("genai.systems_inference.kvcache.pagedattention", "genai.systems_inference.optimization.continuous_batching", "ENABLES");
e("genai.systems_inference.serving.vllm", "genai.systems_inference.kvcache.pagedattention", "USED_IN");
e("genai.models.moe", "genai.systems_inference.parallelism.expert", "REQUIRES");
e("genai.systems_inference.kvcache.kv_cache", "genai.models.transformer.attention.self_attention", "USED_IN");
e("genai.models.transformer.attention.self_attention", "genai.systems_inference.kvcache.kv_cache", "PREREQUISITE_OF");
e("genai.models.transformer.attention.mqa_gqa", "genai.systems_inference.kvcache.kv_cache", "OPTIMIZED_BY");

// Observability ↔ evals ↔ governance
e("genai.llmops.observability.opentelemetry.genai", "genai.agents_tools", "INSTRUMENTED_BY");
e("genai.llmops.observability.opentelemetry.genai", "genai.llmops.stack.tracing_backend", "USED_IN");
e("genai.llmops.observability.opentelemetry.genai", "genai.governance.artifacts.audit_logs", "ENABLES");
e("genai.governance.frameworks.nist_ai_rmf", "genai.governance.artifacts.risk_assessments", "REQUIRES");
e("genai.governance.frameworks.iso_42001", "genai.governance", "STANDARDIZED_BY");
e("genai.governance.regulation.eu_ai_act", "genai.governance", "GOVERNED_BY");

// Reasoning models ↔ alignment
e("genai.models.reasoning_models", "genai.training_alignment.rlft", "TRAINED_WITH");
e("genai.models.reasoning_models", "genai.training_alignment.rlft.process_supervision", "EVALUATED_BY");
e("genai.models.reasoning_models.tts", "genai.foundations.scaling.test_time_compute", "INSTANCE_OF");
e("genai.training_alignment.alignment_targets.deliberative_alignment", "genai.models.reasoning_models", "USED_IN");

// SSM ↔ inference advantages
e("genai.models.ssm", "genai.systems_inference.deployment.edge_device", "ENABLES");
e("genai.models.ssm", "genai.models.transformer", "COMPETES_WITH");

// Safety training ↔ threats
e("genai.training_alignment.safety_training.adversarial", "genai.security_safety.jailbreaks", "MITIGATED_BY");
e("genai.training_alignment.safety_training.pi_robustness", "genai.security_safety.prompt_injection.indirect", "MITIGATED_BY");
e("genai.training_alignment.safety_training.poisoning_defense", "genai.security_safety.data_poisoning", "MITIGATED_BY");
e("genai.training_alignment.safety_training.refusal", "genai.training_alignment.alignment_targets.hhh", "ALIGNED_WITH");

// Agent safety ↔ agent architecture
e("genai.agents_tools.safety.human_approval", "genai.product_design.product_patterns.hitl", "INSTANCE_OF");
e("genai.agents_tools.safety.output_constraints", "genai.models.transformer.output_heads.structured_generation", "USED_IN");
e("genai.security_safety.controls.monitoring_alerting", "genai.llmops.observability", "DEPENDS_ON");

// Product design ↔ evals
e("genai.product_design.product_patterns.eval_driven", "genai.llmops.evals", "DEPENDS_ON");
e("genai.product_design.product_patterns.data_flywheel_integration", "genai.adaptive_flywheels.data_flywheel", "INSTANCE_OF");
e("genai.product_design.product_patterns.multi_model_routing", "genai.models.reasoning_models.tts.compute_optimal", "INSTANCE_OF");

// Memory ↔ privacy/governance
e("genai.knowledge_memory.memory.governance", "genai.governance.artifacts.access_control", "DEPENDS_ON");
e("genai.knowledge_memory.memory.personalization", "genai.foundations.problem_families.personalization_privacy", "DEPENDS_ON");
e("genai.product_design.ux_concepts.privacy_ux", "genai.knowledge_memory.memory.governance", "DEPENDS_ON");

// Flywheel failure ↔ safety
e("genai.adaptive_flywheels.failure_modes.poisoning_feedback", "genai.security_safety.data_poisoning", "IS_A");
e("genai.adaptive_flywheels.failure_modes.bias_amplification", "genai.governance", "GOVERNED_BY");

// ─────────────────────────────────────────────
// SOURCES
// ─────────────────────────────────────────────
src("source_seed_kv", "seed://kv-cache", "KV cache notes");
src("source_mcp", "https://modelcontextprotocol.io/", "Model Context Protocol");
src("source_flashattention", "https://arxiv.org/abs/2205.14135", "FlashAttention (paper)");
src("source_vllm", "https://arxiv.org/abs/2309.06180", "vLLM / PagedAttention (paper)");
src("source_otel_genai", "https://opentelemetry.io/docs/specs/semconv/gen-ai/", "OpenTelemetry GenAI semantic conventions");
src("source_owasp_llm_top10", "https://owasp.org/www-project-top-10-for-large-language-model-applications/", "OWASP Top 10 for LLM Applications");
src("source_nist_ai_rmf", "https://www.nist.gov/itl/ai-risk-management-framework", "NIST AI Risk Management Framework (AI RMF 1.0)");
src("source_graphrag", "https://arxiv.org/abs/2404.16130", "GraphRAG (Microsoft Research)");
src("source_mamba", "https://arxiv.org/abs/2312.00752", "Mamba: Linear-Time Sequence Modeling with Selective State Spaces");
src("source_mamba2", "https://arxiv.org/abs/2405.21060", "Transformers are SSMs (Mamba-2)");
src("source_switch_transformer", "https://arxiv.org/abs/2101.03961", "Switch Transformers: Scaling to Trillion Parameter Models");
src("source_dpo", "https://arxiv.org/abs/2305.18290", "Direct Preference Optimization");
src("source_constitutional_ai", "https://arxiv.org/abs/2212.08073", "Constitutional AI: Harmlessness from AI Feedback");
src("source_instructgpt", "https://arxiv.org/abs/2203.02155", "InstructGPT / Training language models to follow instructions with human feedback");
src("source_self_rag", "https://arxiv.org/abs/2310.11511", "Self-RAG: Learning to Retrieve, Generate, and Critique");
src("source_rag_fusion", "https://arxiv.org/abs/2402.03367", "RAG-Fusion: Multi-query RAG with Reciprocal Rank Fusion");
src("source_react", "https://arxiv.org/abs/2210.03629", "ReAct: Synergizing Reasoning and Acting in Language Models");
src("source_lora", "https://arxiv.org/abs/2106.09685", "LoRA: Low-Rank Adaptation of Large Language Models");
src("source_iso_42001", "https://www.iso.org/standard/81230.html", "ISO/IEC 42001:2023 AI Management System");
src("source_eu_ai_act", "https://artificialintelligenceact.eu/", "EU AI Act");
src("source_ms_hai_guidelines", "https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/", "Guidelines for Human-AI Interaction");
src("source_google_pair", "https://pair.withgoogle.com/guidebook", "Google PAIR People + AI Guidebook");
src("source_a2a", "https://google.github.io/A2A/", "Agent2Agent (A2A) Protocol");
src("source_red_teaming_meta", "https://arxiv.org/abs/2407.16205", "Red-Teaming for Generative AI: Silver Bullet or Security Theater?");
src("source_naptime", "https://googleprojectzero.blogspot.com/2024/06/project-naptime.html", "Project Naptime: LLM-assisted vulnerability research");
src("source_scaling_laws", "https://arxiv.org/abs/2001.08361", "Scaling Laws for Neural Language Models");
src("source_rope", "https://arxiv.org/abs/2104.09864", "RoFormer: Enhanced Transformer with Rotary Position Embedding");
src("source_ms_rai", "https://www.microsoft.com/en-us/ai/responsible-ai", "Microsoft Responsible AI");
src("source_google_saif", "https://safety.google/cybersecurity-advancements/saif/", "Google SAIF: Secure AI Framework");

// ─────────────────────────────────────────────
// CHUNKS (keep original)
// ─────────────────────────────────────────────
chunks.push({
  id: "chunk_seed_kv_1",
  sourceId: "source_seed_kv",
  content: "During autoregressive decoding, keys and values from previous tokens are cached per layer to avoid recomputing attention over the full prefix.",
  startOffset: 0,
  endOffset: 142,
});

// ─────────────────────────────────────────────
// CONCEPT-SOURCE LINKS
// ─────────────────────────────────────────────
const conceptSources = [
  { conceptId: "genai.systems_inference.kvcache.kv_cache", sourceId: "source_seed_kv" },
  { conceptId: "genai.agents_tools.protocols.mcp", sourceId: "source_mcp" },
  { conceptId: "genai.systems_inference.attention.flashattention", sourceId: "source_flashattention" },
  { conceptId: "genai.systems_inference.serving.vllm", sourceId: "source_vllm" },
  { conceptId: "genai.llmops.observability.opentelemetry.genai", sourceId: "source_otel_genai" },
  { conceptId: "genai.security_safety.owasp_llm_top_10", sourceId: "source_owasp_llm_top10" },
  { conceptId: "genai.governance.frameworks.nist_ai_rmf", sourceId: "source_nist_ai_rmf" },
  { conceptId: "genai.knowledge_memory.rag.graphrag", sourceId: "source_graphrag" },
  { conceptId: "genai.models.ssm.mamba", sourceId: "source_mamba" },
  { conceptId: "genai.models.ssm.mamba2", sourceId: "source_mamba2" },
  { conceptId: "genai.models.moe.switch_transformer", sourceId: "source_switch_transformer" },
  { conceptId: "genai.training_alignment.rlft.dpo", sourceId: "source_dpo" },
  { conceptId: "genai.training_alignment.rlft.constitutional_ai", sourceId: "source_constitutional_ai" },
  { conceptId: "genai.training_alignment.rlft.rlhf", sourceId: "source_instructgpt" },
  { conceptId: "genai.knowledge_memory.rag.self_rag", sourceId: "source_self_rag" },
  { conceptId: "genai.knowledge_memory.rag.rag_fusion", sourceId: "source_rag_fusion" },
  { conceptId: "genai.agents_tools.architectures.react", sourceId: "source_react" },
  { conceptId: "genai.training_alignment.finetuning.lora", sourceId: "source_lora" },
  { conceptId: "genai.governance.frameworks.iso_42001", sourceId: "source_iso_42001" },
  { conceptId: "genai.governance.regulation.eu_ai_act", sourceId: "source_eu_ai_act" },
  { conceptId: "genai.product_design.hai_foundations.ms_18_guidelines", sourceId: "source_ms_hai_guidelines" },
  { conceptId: "genai.product_design.hai_foundations.google_pair", sourceId: "source_google_pair" },
  { conceptId: "genai.agents_tools.protocols.a2a", sourceId: "source_a2a" },
  { conceptId: "genai.security_safety.red_teaming", sourceId: "source_red_teaming_meta" },
  { conceptId: "genai.security_safety.red_teaming.project_naptime", sourceId: "source_naptime" },
  { conceptId: "genai.foundations.scaling.scaling_laws", sourceId: "source_scaling_laws" },
  { conceptId: "genai.models.transformer.positional_encoding.rope", sourceId: "source_rope" },
  { conceptId: "genai.governance.principles.microsoft_rai", sourceId: "source_ms_rai" },
  { conceptId: "genai.governance.principles.google_ai", sourceId: "source_google_saif" },
];

// ─────────────────────────────────────────────
// CHANGESETS & REVIEW ITEMS (keep originals)
// ─────────────────────────────────────────────
const changesets = [{ id: "changeset_seed_1", status: "draft" }];

const changesetItems = [
  {
    id: "changeset_item_seed_concept_1",
    changesetId: "changeset_seed_1",
    entityType: "concept",
    action: "create",
    status: "pending",
    payload: {
      id: "genai.systems_inference.attention.pagedattention",
      title: "Paged attention",
      kind: "Method",
      l0: "A memory layout and scheduling strategy for attention/KV cache that can reduce memory overhead at inference time.",
      l1: ["Often discussed in the context of high-throughput serving", "Interacts with KV cache organization"],
      l2: [],
      module: "inference",
    },
  },
  {
    id: "changeset_item_seed_edge_1",
    changesetId: "changeset_seed_1",
    entityType: "edge",
    action: "create",
    status: "pending",
    payload: {
      fromConceptId: "genai.systems_inference.kvcache.kv_cache",
      toConceptId: "genai.systems_inference.attention.pagedattention",
      type: "OPTIMIZED_BY",
      evidenceChunkIds: ["chunk_seed_kv_1"],
    },
  },
];

const reviewItems = [
  {
    id: "review_item_seed_kv_1",
    conceptId: "genai.systems_inference.kvcache.kv_cache",
    type: "CLOZE",
    prompt: "KV cache stores ___ and ___ tensors per layer during decoding.",
    answer: { blanks: ["K", "V"] },
    rubric: { explanation: "Keys and values." },
    status: "active",
    dueAt: 0,
  },
  {
    id: "review_item_seed_attn_1",
    conceptId: "genai.models.transformer.attention.self_attention",
    type: "CLOZE",
    prompt: "Self-attention weights are proportional to Softmax( ___ ).",
    answer: { blanks: ["QK^T"] },
    rubric: { explanation: "Often written Softmax(QK^T / sqrt(d_k))." },
    status: "active",
    dueAt: 0,
  },
];

// ─────────────────────────────────────────────
// DEDUPLICATE (concepts may be declared multiple times for the same id)
// ─────────────────────────────────────────────
const seenConcepts = new Set();
const dedupedConcepts = [];
for (const concept of concepts) {
  if (!seenConcepts.has(concept.id)) {
    seenConcepts.add(concept.id);
    dedupedConcepts.push(concept);
  }
}

// Verify edge references
const conceptIds = new Set(dedupedConcepts.map((c) => c.id));
let edgeErrors = 0;
for (const edge of edges) {
  if (!conceptIds.has(edge.fromConceptId)) {
    console.error(`Edge ${edge.id}: missing fromConceptId "${edge.fromConceptId}"`);
    edgeErrors++;
  }
  if (!conceptIds.has(edge.toConceptId)) {
    console.error(`Edge ${edge.id}: missing toConceptId "${edge.toConceptId}"`);
    edgeErrors++;
  }
}
if (edgeErrors > 0) {
  console.error(`\n${edgeErrors} edge reference error(s) found. Fix before proceeding.`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────
const graph = {
  concepts: dedupedConcepts,
  sources,
  chunks,
  edges,
  changesets,
  changesetItems,
  reviewItems,
  conceptSources,
};

fs.writeFileSync(OUT, JSON.stringify(graph, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
console.log(`  Concepts: ${dedupedConcepts.length}`);
console.log(`  Edges: ${edges.length}`);
console.log(`  Sources: ${sources.length}`);
console.log(`  Concept-Source links: ${conceptSources.length}`);
