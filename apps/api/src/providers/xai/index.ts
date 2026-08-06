import { createOpenAIAdapter } from "../openai/index.js";
import type { ChatAdapter } from "../types.js";

export interface XaiAdapterOptions {
  apiKey: string;
  /** Default: https://api.x.ai/v1 (OpenAI-compatible Chat Completions) */
  baseUrl?: string;
}

/**
 * xAI Grok adapter — OpenAI-compatible Chat Completions API.
 * @see https://docs.x.ai / https://api.x.ai/v1
 */
export function createXaiAdapter(opts: XaiAdapterOptions): ChatAdapter {
  const base = createOpenAIAdapter({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl ?? "https://api.x.ai/v1",
  });

  return {
    ...base,
    id: "xai",
  };
}
