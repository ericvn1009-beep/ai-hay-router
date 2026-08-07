import type { TokenBreakdown } from "../db/types.js";

export function emptyBreakdown(): TokenBreakdown {
  return {
    input: 0,
    output: 0,
    cachedInput: 0,
    reasoning: 0,
    image: 0,
    audio: 0,
    tool: 0,
    total: 0,
  };
}

/**
 * Normalize OpenAI / Anthropic / xAI usage objects into a stable breakdown.
 * Unknown fields are ignored; totals prefer provider total when present.
 */
export function parseTokenBreakdown(
  usage: unknown,
  fallback?: { prompt: number; completion: number },
): TokenBreakdown {
  const b = emptyBreakdown();
  if (!usage || typeof usage !== "object") {
    b.input = fallback?.prompt ?? 0;
    b.output = fallback?.completion ?? 0;
    b.total = b.input + b.output;
    return b;
  }
  const u = usage as Record<string, unknown>;

  // OpenAI-style
  const prompt =
    num(u.prompt_tokens) ?? num(u.input_tokens) ?? fallback?.prompt ?? 0;
  const completion =
    num(u.completion_tokens) ?? num(u.output_tokens) ?? fallback?.completion ?? 0;
  b.input = prompt;
  b.output = completion;

  const ptd = asObj(u.prompt_tokens_details) ?? asObj(u.input_tokens_details);
  if (ptd) {
    b.cachedInput = num(ptd.cached_tokens) ?? num(ptd.cache_read_input_tokens) ?? 0;
    b.image = num(ptd.image_tokens) ?? 0;
    b.audio += num(ptd.audio_tokens) ?? 0;
  }
  const ctd =
    asObj(u.completion_tokens_details) ?? asObj(u.output_tokens_details);
  if (ctd) {
    b.reasoning = num(ctd.reasoning_tokens) ?? 0;
    b.audio += num(ctd.audio_tokens) ?? 0;
  }

  // Anthropic cache
  b.cachedInput =
    b.cachedInput ||
    (num(u.cache_read_input_tokens) ?? 0) ||
    (num(u.cache_creation_input_tokens) ?? 0);

  const total = num(u.total_tokens);
  b.total =
    total ??
    Math.max(
      b.input + b.output,
      b.input + b.output + b.reasoning /* reasoning sometimes inside completion */,
    );

  return b;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function breakdownToOpenAiUsage(b: TokenBreakdown): Record<string, unknown> {
  const usage: Record<string, unknown> = {
    prompt_tokens: b.input,
    completion_tokens: b.output,
    total_tokens: b.total || b.input + b.output,
  };
  if (b.cachedInput > 0 || b.image > 0) {
    usage.prompt_tokens_details = {
      cached_tokens: b.cachedInput,
      image_tokens: b.image,
    };
  }
  if (b.reasoning > 0) {
    usage.completion_tokens_details = {
      reasoning_tokens: b.reasoning,
    };
  }
  return usage;
}
