import type { ChatAdapter, ProviderError } from "../providers/types.js";
import type { ChatCompletion, ChatCompletionChunk, NormalizedChatRequest } from "../types/chat.js";
import type { Attempt } from "./attempt-plan.js";

export interface ExecuteResultNonStream {
  completion: ChatCompletion;
  provider: string;
  modelUsed: string;
  endpointId: string;
  latencyMs: number;
}

export interface ExecuteStreamResult {
  stream: AsyncIterable<ChatCompletionChunk>;
  provider: string;
  modelUsed: string;
  endpointId: string;
  /** Called when stream ends or errors; latency from start. */
  startedAt: number;
}

export async function executeNonStream(opts: {
  adapter: ChatAdapter;
  attempt: Attempt;
  input: NormalizedChatRequest;
  requestId: string;
  apiKey: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ExecuteResultNonStream> {
  const started = Date.now();
  const req = opts.adapter.buildRequest(
    { ...opts.input, stream: false },
    opts.attempt.upstreamModel,
  );
  const url = req.url;
  const headers = withCredential(req.headers, opts.adapter.id, opts.apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: req.body,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const err: ProviderError = {
        status: res.status,
        message: extractErrorMessage(json, res.statusText),
        body: json,
      };
      throw Object.assign(new Error(err.message), { providerError: err });
    }

    const completion = opts.adapter.parseResponse(json, {
      requestId: opts.requestId,
      logicalModel: opts.attempt.logicalModel,
      upstreamModel: opts.attempt.upstreamModel,
    });

    return {
      completion,
      provider: opts.attempt.provider,
      modelUsed: opts.attempt.logicalModel,
      endpointId: opts.attempt.endpointId,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export async function executeStream(opts: {
  adapter: ChatAdapter;
  attempt: Attempt;
  input: NormalizedChatRequest;
  requestId: string;
  apiKey: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ExecuteStreamResult> {
  const startedAt = Date.now();
  const req = opts.adapter.buildRequest(
    { ...opts.input, stream: true },
    opts.attempt.upstreamModel,
  );
  const url = req.url;
  const headers = withCredential(req.headers, opts.adapter.id, opts.apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: req.body,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
    throw e;
  }

  if (!res.ok) {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    const err: ProviderError = {
      status: res.status,
      message: extractErrorMessage(json, res.statusText),
      body: json,
    };
    throw Object.assign(new Error(err.message), { providerError: err });
  }

  if (!res.body) {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
    throw Object.assign(new Error("Upstream returned empty body"), {
      providerError: { message: "empty body", status: 502 } satisfies ProviderError,
    });
  }

  const body = res.body;
  const adapter = opts.adapter;
  const attempt = opts.attempt;
  const requestId = opts.requestId;

  async function* wrapped(): AsyncIterable<import("../types/chat.js").ChatCompletionChunk> {
    try {
      yield* adapter.parseStream(body, {
        requestId,
        logicalModel: attempt.logicalModel,
        upstreamModel: attempt.upstreamModel,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    stream: wrapped(),
    provider: attempt.provider,
    modelUsed: attempt.logicalModel,
    endpointId: attempt.endpointId,
    startedAt,
  };
}

function withCredential(
  headers: Record<string, string>,
  adapterId: string,
  apiKey: string,
): Record<string, string> {
  const h = { ...headers };
  // OpenAI-compatible (OpenAI, xAI/Grok)
  if (adapterId === "openai" || adapterId === "xai") {
    h.authorization = `Bearer ${apiKey}`;
  } else if (adapterId === "anthropic") {
    h["x-api-key"] = apiKey;
  }
  return h;
}

function extractErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (o.error && typeof o.error === "object") {
      const e = o.error as Record<string, unknown>;
      if (typeof e.message === "string") return e.message;
    }
    if (typeof o.message === "string") return o.message;
  }
  return fallback || "Upstream error";
}

export function getProviderError(e: unknown): ProviderError | undefined {
  if (e && typeof e === "object" && "providerError" in e) {
    return (e as { providerError: ProviderError }).providerError;
  }
  if (e instanceof Error && e.name === "AbortError") {
    return { message: "Request timeout or aborted", status: 408 };
  }
  if (e instanceof Error) {
    return { message: e.message };
  }
  return undefined;
}
