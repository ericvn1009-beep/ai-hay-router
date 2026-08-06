import { describe, expect, it } from "vitest";
import { createXaiAdapter } from "../xai/index.js";

describe("xai (Grok) adapter", () => {
  const adapter = createXaiAdapter({ apiKey: "xai-test" });

  it("uses xai id and api.x.ai chat completions URL", () => {
    expect(adapter.id).toBe("xai");
    const req = adapter.buildRequest(
      {
        model: "xai/grok-4.5",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        max_tokens: 16,
      },
      "grok-4.5",
    );
    expect(req.url).toBe("https://api.x.ai/v1/chat/completions");
    expect(req.headers.authorization).toBe("Bearer xai-test");
    const body = JSON.parse(req.body);
    expect(body.model).toBe("grok-4.5");
  });

  it("rewrites logical model id on response", () => {
    const completion = adapter.parseResponse(
      {
        id: "chatcmpl-x",
        object: "chat.completion",
        created: 1,
        model: "grok-4.5",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "hello from grok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      },
      {
        requestId: "r1",
        logicalModel: "xai/grok-4.5",
        upstreamModel: "grok-4.5",
      },
    );
    expect(completion.model).toBe("xai/grok-4.5");
    expect(completion.choices[0].message.content).toBe("hello from grok");
  });

  it("classifies rate limits like OpenAI-compatible hosts", () => {
    expect(adapter.classifyError({ status: 429, message: "rate" })).toBe("rate_limit");
    expect(adapter.classifyError({ status: 503, message: "busy" })).toBe("retriable");
  });
});
