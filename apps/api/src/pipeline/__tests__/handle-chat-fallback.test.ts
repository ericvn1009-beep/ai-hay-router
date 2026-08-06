import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../config.js";
import { createLogger } from "../../lib/logger.js";
import type { ModelRecord } from "../../registry/types.js";
import { handleChatNonStream } from "../handle-chat.js";

function model(id: string, provider: string, upstream: string): ModelRecord {
  return {
    id,
    provider,
    upstream_id: upstream,
    context_length: 128000,
    supports_tools: false,
    supports_streaming: true,
    input_price_per_mtok: 1,
    output_price_per_mtok: 1,
    active: true,
    endpoints: [
      {
        id: `${provider}-primary`,
        base_url:
          provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com",
        credential_ref: provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY",
        priority: 1,
      },
    ],
    fallback_models: [],
  };
}

describe("handleChatNonStream fallback", () => {
  it("falls back to second model after retriable primary failure", async () => {
    const primary = model("openai/a", "openai", "a");
    primary.fallback_models = ["anthropic/b"];
    const secondary = model("anthropic/b", "anthropic", "b");
    const registry = new Map([
      [primary.id, primary],
      [secondary.id, secondary],
    ]);

    const config = {
      OPENAI_API_KEY: "sk-openai",
      ANTHROPIC_API_KEY: "sk-ant",
      REQUEST_TIMEOUT_MS: 5000,
      MAX_ATTEMPTS: 3,
      DEFAULT_MAX_TOKENS: 64,
    } as AppConfig;

    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls += 1;
        if (String(url).includes("openai")) {
          return new Response(JSON.stringify({ error: { message: "down" } }), { status: 503 });
        }
        // anthropic success
        return new Response(
          JSON.stringify({
            id: "msg_1",
            model: "b",
            content: [{ type: "text", text: "fallback-ok" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    try {
      const result = await handleChatNonStream(
        {
          model: "openai/a",
          messages: [{ role: "user", content: "hi" }],
          stream: false,
          max_tokens: 16,
        },
        {
          config,
          registry,
          logger: createLogger("error"),
          requestId: "test",
        },
      );
      expect(result.modelUsed).toBe("anthropic/b");
      expect(result.provider).toBe("anthropic");
      expect(result.completion.choices[0].message.content).toBe("fallback-ok");
      expect(calls).toBeGreaterThanOrEqual(2);
      expect(result.attemptCount).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
