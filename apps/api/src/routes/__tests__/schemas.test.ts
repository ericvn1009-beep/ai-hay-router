import { describe, expect, it } from "vitest";
import { AppError } from "../../lib/errors.js";
import type { ModelRecord } from "../../registry/types.js";
import { validateAndNormalizeChat } from "../schemas.js";

const toolModel: ModelRecord = {
  id: "openai/gpt-4o",
  provider: "openai",
  upstream_id: "gpt-4o",
  context_length: 128000,
  supports_tools: true,
  supports_vision: true,
  supports_streaming: true,
  input_price_per_mtok: 1,
  output_price_per_mtok: 1,
  active: true,
  endpoints: [],
  fallback_models: [],
};

const textOnly: ModelRecord = {
  ...toolModel,
  id: "xai/text-only",
  supports_tools: false,
  supports_vision: false,
};

describe("validateAndNormalizeChat", () => {
  it("accepts text chat", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      },
      4096,
    );
    expect(n.model).toBe("openai/gpt-4o-mini");
    expect(n.stream).toBe(false);
    expect(n.max_tokens).toBe(4096);
  });

  it("clamps max_tokens", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 99999,
      },
      100,
    );
    expect(n.max_tokens).toBe(100);
  });

  it("rejects tools when feature off", () => {
    expect(() =>
      validateAndNormalizeChat(
        {
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hi" }],
          tools: [{ type: "function", function: { name: "x" } }],
        },
        { defaultMaxTokens: 4096, toolsVisionEnabled: false, model: toolModel },
      ),
    ).toThrow(AppError);
  });

  it("accepts tools when feature on and model supports", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "hi" }],
        tools: [{ type: "function", function: { name: "x", parameters: {} } }],
        tool_choice: "auto",
      },
      { defaultMaxTokens: 4096, toolsVisionEnabled: true, model: toolModel },
    );
    expect(n.tools).toHaveLength(1);
    expect(n.tool_choice).toBe("auto");
  });

  it("rejects tools when model lacks supports_tools", () => {
    expect(() =>
      validateAndNormalizeChat(
        {
          model: "xai/text-only",
          messages: [{ role: "user", content: "hi" }],
          tools: [{ type: "function", function: { name: "x" } }],
        },
        { defaultMaxTokens: 4096, toolsVisionEnabled: true, model: textOnly },
      ),
    ).toThrow(/does not support tools/i);
  });

  it("accepts vision content when enabled", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what is this?" },
              { type: "image_url", image_url: { url: "https://example.com/a.png" } },
            ],
          },
        ],
      },
      { defaultMaxTokens: 4096, toolsVisionEnabled: true, model: toolModel },
    );
    expect(Array.isArray(n.messages[0]?.content)).toBe(true);
  });
});
