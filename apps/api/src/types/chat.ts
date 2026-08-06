/** OpenAI-compatible chat types used as the external contract. */

export type ChatRole = "system" | "user" | "assistant" | "tool" | "function";

/** Multimodal content part (OpenAI-style). */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } }
  | Record<string, unknown>;

export type ChatContent = string | null | ChatContentPart[];

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
  name?: string;
  tool_calls?: unknown;
  tool_call_id?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  n?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  /** AI Hay extension: model fallback chain */
  models?: string[];
  tools?: unknown[];
  tool_choice?: unknown;
  functions?: unknown[];
  function_call?: unknown;
  response_format?: unknown;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
  system_fingerprint?: string | null;
}

export interface ChatCompletionChunkDelta {
  role?: ChatRole;
  content?: string | null;
  tool_calls?: unknown;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: ChatCompletionUsage;
}

export interface NormalizedChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  user?: string;
  models?: string[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
}

export interface OpenAIErrorBody {
  error: {
    message: string;
    type: string;
    code?: string | null;
    param?: string | null;
  };
}
