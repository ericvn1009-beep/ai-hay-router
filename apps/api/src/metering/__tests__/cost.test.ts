import { describe, expect, it } from "vitest";
import type { ModelRecord } from "../../registry/types.js";
import { estimateCostUsd } from "../cost.js";

const model: ModelRecord = {
  id: "openai/x",
  provider: "openai",
  upstream_id: "x",
  context_length: 1,
  supports_tools: false,
  supports_streaming: true,
  input_price_per_mtok: 1,
  output_price_per_mtok: 2,
  active: true,
  endpoints: [],
  fallback_models: [],
};

describe("estimateCostUsd", () => {
  it("computes from per-mtok prices", () => {
    // 1M prompt + 1M completion → 1 + 2 = 3
    expect(
      estimateCostUsd({ model, promptTokens: 1_000_000, completionTokens: 1_000_000 }),
    ).toBe(3);
  });

  it("returns 0 without model", () => {
    expect(estimateCostUsd({ model: undefined, promptTokens: 10, completionTokens: 10 })).toBe(0);
  });
});
