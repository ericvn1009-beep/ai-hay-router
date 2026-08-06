import { describe, expect, it } from "vitest";
import { loadRegistryFromYaml, parseSimpleYamlModels } from "../load.js";

describe("registry load", () => {
  it("parses seed models.yaml", () => {
    const map = loadRegistryFromYaml();
    expect(map.size).toBeGreaterThanOrEqual(2);
    expect(map.get("openai/gpt-4o-mini")?.provider).toBe("openai");
    expect(map.get("anthropic/claude-haiku-4-5")?.upstream_id).toBe("claude-haiku-4-5");
  });

  it("parses endpoints", () => {
    const models = parseSimpleYamlModels(`
models:
  - id: openai/x
    provider: openai
    upstream_id: x
    context_length: 1
    supports_tools: false
    supports_streaming: true
    input_price_per_mtok: 1
    output_price_per_mtok: 2
    active: true
    endpoints:
      - id: openai-primary
        base_url: https://api.openai.com/v1
        credential_ref: OPENAI_API_KEY
        priority: 1
    fallback_models: []
`);
    expect(models[0].endpoints[0].credential_ref).toBe("OPENAI_API_KEY");
  });
});
