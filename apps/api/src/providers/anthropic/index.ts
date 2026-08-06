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

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
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
        content: Array<{ type: string; text?: string }>;
        stop_reason: string | null;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const text = (data.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join("");

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
            message: { role: "assistant", content: text },
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

        if (type === "content_block_delta") {
          const delta = event.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            if (!sentRole) {
              sentRole = true;
              yield chunk(id, created, ctx.logicalModel, { role: "assistant", content: delta.text }, null);
            } else {
              yield chunk(id, created, ctx.logicalModel, { content: delta.text }, null);
            }
          }
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

        // message_stop / ping / content_block_* ignored
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

function splitSystem(messages: ChatMessage[]): {
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
    if (m.role === "user" || m.role === "assistant") {
      out.push({
        role: m.role,
        content: m.content ?? "",
      });
    }
    // tool / function roles: rejected earlier in validation for V1
  }

  // Anthropic requires alternating user/assistant starting with user.
  // If first is assistant, prefix a placeholder user message.
  if (out.length > 0 && out[0].role === "assistant") {
    out.unshift({ role: "user", content: "(continued)" });
  }

  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: out,
  };
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
