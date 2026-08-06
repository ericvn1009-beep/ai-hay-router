import type { ModelRecord } from "../registry/types.js";

export function estimateCostUsd(opts: {
  model: ModelRecord | undefined;
  promptTokens: number;
  completionTokens: number;
}): number {
  if (!opts.model) return 0;
  const input = (opts.promptTokens / 1_000_000) * opts.model.input_price_per_mtok;
  const output = (opts.completionTokens / 1_000_000) * opts.model.output_price_per_mtok;
  return round6(input + output);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
