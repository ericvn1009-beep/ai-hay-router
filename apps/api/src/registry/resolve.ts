import { openaiError } from "../lib/errors.js";
import type { ModelRecord } from "./types.js";

export function resolveModel(
  registry: Map<string, ModelRecord>,
  modelId: string,
): ModelRecord {
  if (modelId === "aihay/auto" || modelId.startsWith("aihay/")) {
    throw openaiError(
      400,
      `Model aliases and auto routing are not available in V1: ${modelId}`,
      "model_not_found",
      "model",
    );
  }
  const rec = registry.get(modelId);
  if (!rec || !rec.active) {
    throw openaiError(400, `Unknown model: ${modelId}`, "model_not_found", "model");
  }
  return rec;
}

export function listModels(registry: Map<string, ModelRecord>): ModelRecord[] {
  return [...registry.values()].filter((m) => m.active);
}
