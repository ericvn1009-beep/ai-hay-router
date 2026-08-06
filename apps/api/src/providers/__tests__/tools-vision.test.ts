import { describe, expect, it } from "vitest";
import {
  createAnthropicAdapter,
  mapOpenAIToolsToAnthropic,
  mapToolChoice,
  splitSystem,
} from "../anthropic/index.js";
import { createOpenAIAdapter } from "../openai/index.js";

describe("OpenAI tools/vision passthrough", () => {
  it("includes tools and multimodal messages in request body", () => {
    const adapter = createOpenAIAdapter({ apiKey: "sk-test" });
    const req = adapter.buildRequest(
      {
        model: "openai/gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "describe" },
              { type: "image_url", image_url: { url: "https://x/a.png" } },
            ],
          },
        ],
        stream: false,
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
        tool_choice: "auto",
      },
      "gpt-4o",
    );
    const body = JSON.parse(req.body as string) as {
      tools: unknown[];
      tool_choice: string;
      messages: Array<{ content: unknown }>;
    };
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe("auto");
    expect(Array.isArray(body.messages[0].content)).toBe(true);
  });
});

describe("Anthropic tools/vision mapping", () => {
  it("maps OpenAI tool definitions", () => {
    const mapped = mapOpenAIToolsToAnthropic([
      {
        type: "function",
        function: {
          name: "search",
          description: "Search",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      },
    ]) as Array<{ name: string; input_schema: unknown }>;
    expect(mapped[0]?.name).toBe("search");
    expect(mapped[0]?.input_schema).toBeTruthy();
  });

  it("maps tool_choice", () => {
    expect(mapToolChoice("auto")).toEqual({ type: "auto" });
    expect(mapToolChoice("required")).toEqual({ type: "any" });
    expect(mapToolChoice({ type: "function", function: { name: "x" } })).toEqual({
      type: "tool",
      name: "x",
    });
  });

  it("maps vision image_url and tool messages", () => {
    const { messages } = splitSystem([
      {
        role: "user",
        content: [
          { type: "text", text: "see" },
          { type: "image_url", image_url: { url: "data:image/png;base64,aaa" } },
        ],
      },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "lookup", arguments: "{\"id\":1}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        content: "{\"ok\":true}",
      },
    ]);
    expect(messages[0]?.role).toBe("user");
    expect(Array.isArray(messages[0]?.content)).toBe(true);
    const userBlocks = messages[0]?.content as Array<{ type: string }>;
    expect(userBlocks.some((b) => b.type === "image")).toBe(true);
    expect(messages.some((m) => m.role === "assistant")).toBe(true);
    const toolUser = messages.find(
      (m) =>
        m.role === "user" &&
        Array.isArray(m.content) &&
        (m.content as Array<{ type: string }>).some((b) => b.type === "tool_result"),
    );
    expect(toolUser).toBeTruthy();
  });

  it("buildRequest attaches tools", () => {
    const adapter = createAnthropicAdapter({ apiKey: "sk-ant" });
    const req = adapter.buildRequest(
      {
        model: "anthropic/claude-sonnet-4-0",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        max_tokens: 64,
        tools: [
          {
            type: "function",
            function: { name: "ping", parameters: { type: "object", properties: {} } },
          },
        ],
      },
      "claude-sonnet-4-0",
    );
    const body = JSON.parse(req.body as string) as { tools: Array<{ name: string }> };
    expect(body.tools[0]?.name).toBe("ping");
  });
});
