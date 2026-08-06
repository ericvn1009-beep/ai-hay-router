import { describe, expect, it } from "vitest";
import { createAnthropicAdapter } from "../anthropic/index.js";

describe("anthropic adapter", () => {
  const adapter = createAnthropicAdapter({ apiKey: "sk-ant-test" });

  it("moves system messages and builds Messages API request", () => {
    const req = adapter.buildRequest(
      {
        model: "anthropic/claude-haiku-4-5",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "hi" },
        ],
        stream: false,
        max_tokens: 32,
      },
      "claude-haiku-4-5",
    );
    expect(req.url).toContain("/v1/messages");
    expect(req.headers["x-api-key"]).toBe("sk-ant-test");
    expect(req.headers["anthropic-version"]).toBeTruthy();
    const body = JSON.parse(req.body);
    expect(body.system).toBe("Be brief.");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.max_tokens).toBe(32);
  });

  it("normalizes Messages response to OpenAI chat completion", () => {
    const completion = adapter.parseResponse(
      {
        id: "msg_1",
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: "hello from claude" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 4 },
      },
      {
        requestId: "r1",
        logicalModel: "anthropic/claude-haiku-4-5",
        upstreamModel: "claude-haiku-4-5",
      },
    );
    expect(completion.object).toBe("chat.completion");
    expect(completion.model).toBe("anthropic/claude-haiku-4-5");
    expect(completion.choices[0].message.content).toBe("hello from claude");
    expect(completion.choices[0].finish_reason).toBe("stop");
    expect(completion.usage?.prompt_tokens).toBe(5);
    expect(completion.usage?.completion_tokens).toBe(4);
  });

  it("maps stream text deltas to OpenAI chunks", async () => {
    const events = [
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}\n\n',
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(events));
        controller.close();
      },
    });

    const chunks = [];
    for await (const c of adapter.parseStream(stream, {
      requestId: "r1",
      logicalModel: "anthropic/claude-haiku-4-5",
      upstreamModel: "claude-haiku-4-5",
    })) {
      chunks.push(c);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const text = chunks.map((c) => c.choices[0]?.delta?.content ?? "").join("");
    expect(text).toContain("Hi");
    const last = chunks[chunks.length - 1];
    expect(last.choices[0].finish_reason).toBe("stop");
  });
});
