export type ModelTier = "nano" | "mini";

export const DEFAULT_MODEL_NANO = "gpt-5-nano";
export const DEFAULT_MODEL_MINI = "gpt-5-mini";

export function resolveModel(
  tier: ModelTier,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (tier === "nano") return env.OPENAI_MODEL_NANO ?? DEFAULT_MODEL_NANO;
  return env.OPENAI_MODEL_MINI ?? DEFAULT_MODEL_MINI;
}

