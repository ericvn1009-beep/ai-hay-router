/**
 * Virtual model aliases (V2.4).
 * Rules-only resolution — not smart auto routing.
 */
export const DEFAULT_ALIASES: Record<string, string> = {
  "aihay/cheap": "openai/gpt-4o-mini",
  "aihay/balanced": "anthropic/claude-3-5-haiku-latest",
  "aihay/smart": "openai/gpt-4o",
  "aihay/fast": "xai/grok-3-mini",
};

export function resolveAlias(
  modelId: string,
  aliases: Record<string, string> = DEFAULT_ALIASES,
): { requested: string; resolved: string; isAlias: boolean } {
  const target = aliases[modelId];
  if (target) {
    return { requested: modelId, resolved: target, isAlias: true };
  }
  return { requested: modelId, resolved: modelId, isAlias: false };
}

export function listAliasIds(aliases: Record<string, string> = DEFAULT_ALIASES): string[] {
  return Object.keys(aliases);
}
