import type {
  ChatCompletion,
  ChatCompletionChunk,
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

export interface OpenAIAdapterOptions {
  apiKey: string;
  baseUrl?: string;
}

export function createOpenAIAdapter(opts: OpenAIAdapterOptions): ChatAdapter {
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    id: "openai",

    buildRequest(input: NormalizedChatRequest, upstreamModel: string): ProviderHttpRequest {
      const body: Record<string, unknown> = {
        model: upstreamModel,
        messages: input.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.name ? { name: m.name } : {}),
        })),
        stream: input.stream,
      };
      if (input.temperature !== undefined) body.temperature = input.temperature;
      if (input.max_tokens !== undefined) body.max_tokens = input.max_tokens;
      if (input.top_p !== undefined) body.top_p = input.top_p;
      if (input.stop !== undefined) body.stop = input.stop;
      if (input.user !== undefined) body.user = input.user;
      if (input.stream) {
        body.stream_options = { include_usage: true };
      }

      return {
        url: `${baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
      };
    },

    parseResponse(raw: unknown, ctx: AttemptContext): ChatCompletion {
      const data = raw as ChatCompletion;
      return {
        ...data,
        object: "chat.completion",
        model: ctx.logicalModel,
      };
    },

    async *parseStream(
      raw: ReadableStream<Uint8Array>,
      ctx: AttemptContext,
    ): AsyncIterable<ChatCompletionChunk> {
      for await (const data of readSseDataLines(raw)) {
        if (data === "[DONE]") return;
        let parsed: ChatCompletionChunk;
        try {
          parsed = JSON.parse(data) as ChatCompletionChunk;
        } catch {
          continue;
        }
        yield {
          ...parsed,
          object: "chat.completion.chunk",
          model: ctx.logicalModel,
        };
      }
    },

    classifyError(err: ProviderError): ErrorClass {
      const status = err.status;
      if (status === 429) return "rate_limit";
      if (status === 408 || status === 409) return "retriable";
      if (status !== undefined && status >= 500) return "retriable";
      if (status !== undefined && status >= 400 && status < 500) return "fatal";
      // network / unknown
      return "retriable";
    },
  };
}
