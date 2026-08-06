import { describe, expect, it } from "vitest";
import { createOpenAIAdapter } from "../openai/index.js";

describe("openai adapter", () => {
  const adapter = createOpenAIAdapter({ apiKey: "sk-test" });

  it("builds chat completions request", () => {
    const req = adapter.buildRequest(
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        max_tokens: 10,
      },
      "gpt-4o-mini",
    );
    expect(req.url).toContain("/chat/completions");
    expect(req.headers.authorization).toBe("Bearer sk-test");
    const body = JSON.parse(req.body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0].content).toBe("hi");
    expect(body.stream).toBe(false);
  });

  it("parses non-stream response and rewrites model id", () => {
    const completion = adapter.parseResponse(
      {
        id: "chatcmpl-1",
        object: "chat.completion",
        created: 1,
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "hello" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
      {
        requestId: "r1",
        logicalModel: "openai/gpt-4o-mini",
        upstreamModel: "gpt-4o-mini",
      },
    );
    expect(completion.model).toBe("openai/gpt-4o-mini");
    expect(completion.choices[0].message.content).toBe("hello");
  });

  it("classifies errors", () => {
    expect(adapter.classifyError({ status: 429, message: "rate" })).toBe("rate_limit");
    expect(adapter.classifyError({ status: 500, message: "boom" })).toBe("retriable");
    expect(adapter.classifyError({ status: 400, message: "bad" })).toBe("fatal");
  });
});
