import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatMessage,
  NormalizedChatRequest,
} from "../../types/chat.js";
import type {
  AttemptContext,
  ChatAdapter,
  ErrorClass,
  ProviderError,
  ProviderHttpRequest,
} from "../types.js";
import { readSseDataLines } from "../stream/sse.js";

export interface AnthropicAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64" | "url"; media_type?: string; data?: string; url?: string } }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string | unknown };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

export function createAnthropicAdapter(opts: AnthropicAdapterOptions): ChatAdapter {
  const baseUrl = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const apiVersion = opts.apiVersion ?? "2023-06-01";

  return {
    id: "anthropic",

    buildRequest(input: NormalizedChatRequest, upstreamModel: string): ProviderHttpRequest {
      const { system, messages } = splitSystem(input.messages);
      const body: Record<string, unknown> = {
        model: upstreamModel,
        messages,
        max_tokens: input.max_tokens ?? 1024,
        stream: input.stream,
      };
      if (system) body.system = system;
      if (input.temperature !== undefined) body.temperature = input.temperature;
      if (input.top_p !== undefined) body.top_p = input.top_p;
      if (input.stop !== undefined) {
        body.stop_sequences = Array.isArray(input.stop) ? input.stop : [input.stop];
      }
      if (input.tools?.length) {
        body.tools = mapOpenAIToolsToAnthropic(input.tools);
      }
      if (input.tool_choice !== undefined) {
        body.tool_choice = mapToolChoice(input.tool_choice);
      }

      return {
        url: `${baseUrl}/v1/messages`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": apiVersion,
        },
        body: JSON.stringify(body),
      };
    },

    parseResponse(raw: unknown, ctx: AttemptContext): ChatCompletion {
      const data = raw as {
        id: string;
        model: string;
        content: Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
        }>;
        stop_reason: string | null;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const textParts: string[] = [];
      const toolCalls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }> = [];

      for (const b of data.content ?? []) {
        if (b.type === "text" && typeof b.text === "string") {
          textParts.push(b.text);
        } else if (b.type === "tool_use" && b.id && b.name) {
          toolCalls.push({
            id: b.id,
            type: "function",
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input ?? {}),
            },
          });
        }
      }

      const text = textParts.join("");
      const prompt = data.usage?.input_tokens ?? 0;
      const completion = data.usage?.output_tokens ?? 0;

      return {
        id: data.id ?? `chatcmpl-${ctx.requestId}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: ctx.logicalModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: text || null,
              ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: mapStopReason(data.stop_reason),
          },
        ],
        usage: {
          prompt_tokens: prompt,
          completion_tokens: completion,
          total_tokens: prompt + completion,
        },
      };
    },

    async *parseStream(
      raw: ReadableStream<Uint8Array>,
      ctx: AttemptContext,
    ): AsyncIterable<ChatCompletionChunk> {
      const id = `chatcmpl-${ctx.requestId}`;
      const created = Math.floor(Date.now() / 1000);
      let sentRole = false;
      let inputTokens = 0;
      let outputTokens = 0;
      let toolIndex = 0;

      for await (const data of readSseDataLines(raw)) {
        if (data === "[DONE]") return;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }

        const type = event.type as string | undefined;

        if (type === "message_start") {
          const message = event.message as
            | { usage?: { input_tokens?: number } }
            | undefined;
          inputTokens = message?.usage?.input_tokens ?? inputTokens;
          if (!sentRole) {
            sentRole = true;
            yield chunk(id, created, ctx.logicalModel, { role: "assistant", content: "" }, null);
          }
          continue;
        }

        if (type === "content_block_start") {
          const block = event.content_block as
            | { type?: string; id?: string; name?: string }
            | undefined;
          if (block?.type === "tool_use" && block.id && block.name) {
            if (!sentRole) {
              sentRole = true;
              yield chunk(id, created, ctx.logicalModel, { role: "assistant" }, null);
            }
            yield {
              id,
              object: "chat.completion.chunk",
              created,
              model: ctx.logicalModel,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: toolIndex,
                        id: block.id,
                        type: "function",
                        function: { name: block.name, arguments: "" },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            };
          }
          continue;
        }

        if (type === "content_block_delta") {
          const delta = event.delta as
            | { type?: string; text?: string; partial_json?: string }
            | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            if (!sentRole) {
              sentRole = true;
              yield chunk(id, created, ctx.logicalModel, { role: "assistant", content: delta.text }, null);
            } else {
              yield chunk(id, created, ctx.logicalModel, { content: delta.text }, null);
            }
          } else if (delta?.type === "input_json_delta" && delta.partial_json) {
            yield {
              id,
              object: "chat.completion.chunk",
              created,
              model: ctx.logicalModel,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: toolIndex,
                        function: { arguments: delta.partial_json },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            };
          }
          continue;
        }

        if (type === "content_block_stop") {
          const block = event.content_block as { type?: string } | undefined;
          if (block?.type === "tool_use") toolIndex += 1;
          continue;
        }

        if (type === "message_delta") {
          const usage = event.usage as { output_tokens?: number } | undefined;
          const delta = event.delta as { stop_reason?: string | null } | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
          if (delta?.stop_reason) {
            yield {
              id,
              object: "chat.completion.chunk",
              created,
              model: ctx.logicalModel,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: mapStopReason(delta.stop_reason),
                },
              ],
              usage: {
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
              },
            };
          }
          continue;
        }
      }
    },

    classifyError(err: ProviderError): ErrorClass {
      const status = err.status;
      if (status === 429) return "rate_limit";
      if (status === 408 || status === 409) return "retriable";
      if (status !== undefined && status >= 500) return "retriable";
      if (status !== undefined && status >= 400 && status < 500) return "fatal";
      return "retriable";
    },
  };
}

/** Map OpenAI tools → Anthropic tools. */
export function mapOpenAIToolsToAnthropic(tools: unknown[]): unknown[] {
  return tools.map((t) => {
    const tool = t as {
      type?: string;
      function?: { name?: string; description?: string; parameters?: unknown };
      name?: string;
      description?: string;
      input_schema?: unknown;
    };
    if (tool.type === "function" && tool.function?.name) {
      return {
        name: tool.function.name,
        description: tool.function.description ?? "",
        input_schema: tool.function.parameters ?? { type: "object", properties: {} },
      };
    }
    // Already Anthropic-shaped
    if (tool.name && tool.input_schema) return tool;
    return tool;
  });
}

export function mapToolChoice(choice: unknown): unknown {
  if (choice === "auto" || choice === "none" || choice === "required") {
    if (choice === "required") return { type: "any" };
    if (choice === "none") return { type: "none" };
    return { type: "auto" };
  }
  const c = choice as { type?: string; function?: { name?: string } };
  if (c?.type === "function" && c.function?.name) {
    return { type: "tool", name: c.function.name };
  }
  return choice;
}

/** Exported for tests — convert OpenAI-style messages to Anthropic. */
export function splitSystem(messages: ChatMessage[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content) systemParts.push(m.content);
      continue;
    }

    if (m.role === "tool") {
      const toolResult: AnthropicContent = {
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "unknown",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
      };
      // Anthropic expects tool_result in user messages
      const last = out[out.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) {
        last.content.push(toolResult);
      } else {
        out.push({ role: "user", content: [toolResult] });
      }
      continue;
    }

    if (m.role === "assistant") {
      const blocks: AnthropicContent[] = [];
      if (typeof m.content === "string" && m.content) {
        blocks.push({ type: "text", text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          const mapped = mapContentPart(part);
          if (mapped) blocks.push(mapped);
        }
      }
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls as Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>) {
          if (!tc.id || !tc.function?.name) continue;
          let input: unknown = {};
          try {
            input = JSON.parse(tc.function.arguments ?? "{}");
          } catch {
            input = {};
          }
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }
      out.push({
        role: "assistant",
        content: blocks.length ? blocks : "",
      });
      continue;
    }

    if (m.role === "user") {
      if (typeof m.content === "string" || m.content == null) {
        out.push({ role: "user", content: m.content ?? "" });
      } else if (Array.isArray(m.content)) {
        const blocks: AnthropicContent[] = [];
        for (const part of m.content) {
          const mapped = mapContentPart(part);
          if (mapped) blocks.push(mapped);
        }
        out.push({ role: "user", content: blocks.length ? blocks : "" });
      }
    }
  }

  // Anthropic requires alternating user/assistant starting with user.
  if (out.length > 0 && out[0].role === "assistant") {
    out.unshift({ role: "user", content: "(continued)" });
  }

  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: out,
  };
}

function mapContentPart(part: unknown): AnthropicContent | null {
  const p = part as {
    type?: string;
    text?: string;
    image_url?: { url?: string };
  };
  if (p.type === "text" && typeof p.text === "string") {
    return { type: "text", text: p.text };
  }
  if (p.type === "image_url" && p.image_url?.url) {
    const url = p.image_url.url;
    // data:image/png;base64,....
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: dataMatch[1],
          data: dataMatch[2],
        },
      };
    }
    return {
      type: "image",
      source: { type: "url", url },
    };
  }
  return null;
}

function mapStopReason(reason: string | null | undefined): string {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_calls";
    default:
      return reason ?? "stop";
  }
}

function chunk(
  id: string,
  created: number,
  model: string,
  delta: { role?: "assistant"; content?: string | null },
  finish_reason: string | null,
): ChatCompletionChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason }],
  };
}
