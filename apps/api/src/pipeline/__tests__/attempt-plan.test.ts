import { describe, expect, it } from "vitest";
import type { ModelRecord } from "../../registry/types.js";
import { buildAttemptPlan } from "../attempt-plan.js";

function model(partial: Partial<ModelRecord> & Pick<ModelRecord, "id" | "provider">): ModelRecord {
  return {
    upstream_id: partial.upstream_id ?? "up",
    context_length: 128000,
    supports_tools: false,
    supports_streaming: true,
    input_price_per_mtok: 1,
    output_price_per_mtok: 1,
    active: true,
    endpoints: partial.endpoints ?? [
      {
        id: "primary",
        base_url: "https://example.com",
        credential_ref: "KEY",
        priority: 1,
      },
    ],
    fallback_models: partial.fallback_models ?? [],
    ...partial,
  };
}

describe("buildAttemptPlan", () => {
  it("includes request and registry fallbacks", () => {
    const primary = model({
      id: "openai/a",
      provider: "openai",
      upstream_id: "a",
      fallback_models: ["anthropic/b"],
    });
    const fb = model({
      id: "anthropic/b",
      provider: "anthropic",
      upstream_id: "b",
    });
    const map = new Map([
      [primary.id, primary],
      [fb.id, fb],
    ]);

    const plan = buildAttemptPlan(primary, (id) => map.get(id), ["anthropic/b"], 5);
    expect(plan).toHaveLength(2);
    expect(plan[0].logicalModel).toBe("openai/a");
    expect(plan[1].logicalModel).toBe("anthropic/b");
  });

  it("respects max attempts", () => {
    const primary = model({
      id: "openai/a",
      provider: "openai",
      endpoints: [
        { id: "e1", base_url: "https://a", credential_ref: "K", priority: 1 },
        { id: "e2", base_url: "https://b", credential_ref: "K", priority: 2 },
      ],
    });
    const plan = buildAttemptPlan(primary, () => undefined, undefined, 1);
    expect(plan).toHaveLength(1);
    expect(plan[0].endpointId).toBe("e1");
  });
});
