import type {
  ChatCompletion,
  ChatCompletionChunk,
  NormalizedChatRequest,
} from "../types/chat.js";

export type ErrorClass = "retriable" | "fatal" | "rate_limit";

export interface ProviderHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

export interface AttemptContext {
  requestId: string;
  logicalModel: string;
  upstreamModel: string;
  signal?: AbortSignal;
}

export interface ProviderError {
  status?: number;
  message: string;
  body?: unknown;
  cause?: unknown;
}

export interface ChatAdapter {
  readonly id: string;

  buildRequest(
    input: NormalizedChatRequest,
    upstreamModel: string,
  ): ProviderHttpRequest;

  parseResponse(raw: unknown, ctx: AttemptContext): ChatCompletion;

  /** Parse provider SSE / event stream into OpenAI-compatible chunks. */
  parseStream(
    raw: ReadableStream<Uint8Array>,
    ctx: AttemptContext,
  ): AsyncIterable<ChatCompletionChunk>;

  classifyError(err: ProviderError): ErrorClass;
}

export function isRetriable(cls: ErrorClass): boolean {
  return cls === "retriable" || cls === "rate_limit";
}
