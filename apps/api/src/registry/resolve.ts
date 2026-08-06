import { openaiError } from "../lib/errors.js";
import { DEFAULT_ALIASES, resolveAlias } from "./aliases.js";
import type { ModelRecord } from "./types.js";

export function resolveModel(
  registry: Map<string, ModelRecord>,
  modelId: string,
  opts?: { aliasesEnabled?: boolean; aliases?: Record<string, string> },
): ModelRecord & { aliasRequested?: string } {
  if (modelId === "aihay/auto") {
    throw openaiError(
      400,
      "aihay/auto (smart routing) is not available until V3",
      "model_not_found",
      "model",
    );
  }

  let lookupId = modelId;
  let aliasRequested: string | undefined;

  if (modelId.startsWith("aihay/")) {
    if (!opts?.aliasesEnabled) {
      throw openaiError(
        400,
        `Model aliases are disabled. Enable FEATURE_ALIASES or use a canonical id (e.g. openai/gpt-4o-mini). Got: ${modelId}`,
        "model_not_found",
        "model",
      );
    }
    const { resolved, isAlias } = resolveAlias(modelId, opts.aliases ?? DEFAULT_ALIASES);
    if (!isAlias) {
      throw openaiError(400, `Unknown alias: ${modelId}`, "model_not_found", "model");
    }
    lookupId = resolved;
    aliasRequested = modelId;
  }

  const rec = registry.get(lookupId);
  if (!rec || !rec.active) {
    throw openaiError(
      400,
      aliasRequested
        ? `Alias ${aliasRequested} resolves to unknown/inactive model: ${lookupId}`
        : `Unknown model: ${modelId}`,
      "model_not_found",
      "model",
    );
  }
  return aliasRequested ? { ...rec, aliasRequested } : rec;
}

export function listModels(
  registry: Map<string, ModelRecord>,
  opts?: { aliasesEnabled?: boolean; aliases?: Record<string, string> },
): Array<ModelRecord | { id: string; provider: string; active: true; virtual: true; resolves_to: string }> {
  const base = [...registry.values()].filter((m) => m.active);
  if (!opts?.aliasesEnabled) return base;
  const aliases = opts.aliases ?? DEFAULT_ALIASES;
  const virtual = Object.entries(aliases).map(([id, resolves_to]) => ({
    id,
    provider: "aihay",
    active: true as const,
    virtual: true as const,
    resolves_to,
    // minimal fields for OpenAI list compatibility via route mapper
    upstream_id: resolves_to,
    context_length: 0,
    supports_tools: false,
    supports_streaming: true,
    input_price_per_mtok: 0,
    output_price_per_mtok: 0,
    endpoints: [],
    fallback_models: [],
  }));
  return [...virtual, ...base];
}
