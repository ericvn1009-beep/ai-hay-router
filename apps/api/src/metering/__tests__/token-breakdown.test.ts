import { describe, expect, it } from "vitest";
import { parseTokenBreakdown } from "../token-breakdown.js";

describe("parseTokenBreakdown", () => {
  it("falls back to prompt/completion", () => {
    const b = parseTokenBreakdown(null, { prompt: 10, completion: 5 });
    expect(b.input).toBe(10);
    expect(b.output).toBe(5);
    expect(b.total).toBe(15);
  });

  it("parses OpenAI details", () => {
    const b = parseTokenBreakdown({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 40 },
      completion_tokens_details: { reasoning_tokens: 12 },
    });
    expect(b.cachedInput).toBe(40);
    expect(b.reasoning).toBe(12);
    expect(b.total).toBe(150);
  });

  it("parses Anthropic cache fields", () => {
    const b = parseTokenBreakdown({
      input_tokens: 20,
      output_tokens: 10,
      cache_read_input_tokens: 8,
    });
    expect(b.input).toBe(20);
    expect(b.cachedInput).toBe(8);
  });
});
