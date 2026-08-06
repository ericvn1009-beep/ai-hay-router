import type { AppConfig } from "../config.js";
import type { CredentialMode } from "../db/secret-types.js";
import type { ProviderSecretStore } from "../db/secret-types.js";
import { openaiError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import type { Metrics } from "../observability/metrics.js";
import { createAnthropicAdapter } from "../providers/anthropic/index.js";
import { createOpenAIAdapter } from "../providers/openai/index.js";
import { createXaiAdapter } from "../providers/xai/index.js";
import type { ChatAdapter, ProviderError } from "../providers/types.js";
import { isRetriable } from "../providers/types.js";
import { resolveModel } from "../registry/resolve.js";
import type { ModelRecord } from "../registry/types.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  NormalizedChatRequest,
} from "../types/chat.js";
import { buildAttemptPlan } from "./attempt-plan.js";
import {
  executeNonStream,
  executeStream,
  getProviderError,
} from "./execute-attempt.js";
import { resolveCredential } from "./resolve-credential.js";

export interface HandleChatDeps {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
  requestId: string;
  /** Workspace for BYOK resolution (V2.5) */
  workspaceId: string;
  secrets?: ProviderSecretStore | null;
  signal?: AbortSignal;
  metrics?: Metrics | null;
}

function recordAttempt(
  metrics: Metrics | null | undefined,
  provider: string,
  result: "success" | "error" | "retriable" | "missing_credential",
) {
  metrics?.upstreamAttemptsTotal.inc({ provider, result });
}

export interface HandleChatResultNonStream {
  completion: ChatCompletion;
  modelUsed: string;
  provider: string;
  endpointId: string;
  attemptCount: number;
  latencyMs: number;
  credentialMode: CredentialMode;
}

export interface HandleChatResultStream {
  stream: AsyncIterable<ChatCompletionChunk>;
  modelUsed: string;
  provider: string;
  endpointId: string;
  attemptCount: number;
  startedAt: number;
  credentialMode: CredentialMode;
}

export async function handleChatNonStream(
  input: NormalizedChatRequest,
  deps: HandleChatDeps,
): Promise<HandleChatResultNonStream> {
  const aliasOpts = {
    aliasesEnabled: deps.config.FEATURE_ALIASES,
  };
  const primary = resolveModel(deps.registry, input.model, aliasOpts);
  // Serve under alias id when requested so clients see model they asked for
  const logicalOut = primary.aliasRequested ?? primary.id;
  const attempts = buildAttemptPlan(
    primary,
    (id) => {
      try {
        return resolveModel(deps.registry, id, aliasOpts);
      } catch {
        return undefined;
      }
    },
    input.models,
    deps.config.MAX_ATTEMPTS,
  );

  if (attempts.length === 0) {
    throw openaiError(502, "No upstream endpoints configured for model", "upstream_unavailable");
  }

  let lastError: string | undefined;
  for (const attempt of attempts) {
    const cred = await resolveCredential({
      credentialRef: attempt.credentialRef,
      workspaceId: deps.workspaceId,
      config: deps.config,
      secrets: deps.secrets ?? null,
    });
    if (!cred) {
      lastError = `Missing credential ${attempt.credentialRef}`;
      recordAttempt(deps.metrics, attempt.provider, "missing_credential");
      deps.logger.warn("skip_attempt_missing_credential", {
        request_id: deps.requestId,
        attempt: attempt.n,
        credential_ref: attempt.credentialRef,
      });
      continue;
    }

    const adapter = adapterFor(attempt.provider, cred.apiKey, attempt.baseUrl);
    if (!adapter) {
      lastError = `Unknown provider ${attempt.provider}`;
      continue;
    }

    try {
      const result = await executeNonStream({
        adapter,
        attempt,
        input,
        requestId: deps.requestId,
        apiKey: cred.apiKey,
        timeoutMs: deps.config.REQUEST_TIMEOUT_MS,
        signal: deps.signal,
      });
      recordAttempt(deps.metrics, result.provider, "success");
      // Prefer alias as model_used label when primary was alias
      const modelUsed =
        attempt.logicalModel === primary.id && primary.aliasRequested
          ? logicalOut
          : result.modelUsed;
      deps.logger.info("chat_success", {
        request_id: deps.requestId,
        model: modelUsed,
        provider: result.provider,
        attempt: attempt.n,
        latency_ms: result.latencyMs,
        stream: false,
        credential_mode: cred.mode,
      });
      return {
        completion: { ...result.completion, model: modelUsed },
        modelUsed,
        provider: result.provider,
        endpointId: result.endpointId,
        attemptCount: attempt.n,
        latencyMs: result.latencyMs,
        credentialMode: cred.mode,
      };
    } catch (e) {
      const pe = getProviderError(e);
      const cls = pe
        ? (adapter.classifyError(pe) as ReturnType<ChatAdapter["classifyError"]>)
        : "retriable";
      lastError = pe?.message ?? (e instanceof Error ? e.message : "unknown error");
      recordAttempt(
        deps.metrics,
        attempt.provider,
        pe && !isRetriable(cls) ? "error" : "retriable",
      );
      deps.logger.warn("chat_attempt_failed", {
        request_id: deps.requestId,
        attempt: attempt.n,
        provider: attempt.provider,
        status: pe?.status,
        class: cls,
        message: lastError,
      });
      if (pe && !isRetriable(cls)) {
        throw openaiError(400, lastError, "upstream_error");
      }
      // else continue to next attempt
    }
  }

  throw openaiError(
    502,
    lastError ? `All upstream attempts failed: ${lastError}` : "All upstream attempts failed",
    "upstream_unavailable",
  );
}

/**
 * Stream path: try attempts until first successful upstream response headers,
 * then commit stream (no further failover).
 */
export async function handleChatStream(
  input: NormalizedChatRequest,
  deps: HandleChatDeps,
): Promise<HandleChatResultStream> {
  const aliasOpts = { aliasesEnabled: deps.config.FEATURE_ALIASES };
  const primary = resolveModel(deps.registry, input.model, aliasOpts);
  const logicalOut = primary.aliasRequested ?? primary.id;
  const attempts = buildAttemptPlan(
    primary,
    (id) => {
      try {
        return resolveModel(deps.registry, id, aliasOpts);
      } catch {
        return undefined;
      }
    },
    input.models,
    deps.config.MAX_ATTEMPTS,
  );

  if (attempts.length === 0) {
    throw openaiError(502, "No upstream endpoints configured for model", "upstream_unavailable");
  }

  let lastError: string | undefined;
  for (const attempt of attempts) {
    const cred = await resolveCredential({
      credentialRef: attempt.credentialRef,
      workspaceId: deps.workspaceId,
      config: deps.config,
      secrets: deps.secrets ?? null,
    });
    if (!cred) {
      lastError = `Missing credential ${attempt.credentialRef}`;
      recordAttempt(deps.metrics, attempt.provider, "missing_credential");
      continue;
    }
    const adapter = adapterFor(attempt.provider, cred.apiKey, attempt.baseUrl);
    if (!adapter) {
      lastError = `Unknown provider ${attempt.provider}`;
      continue;
    }

    try {
      const result = await executeStream({
        adapter,
        attempt,
        input,
        requestId: deps.requestId,
        apiKey: cred.apiKey,
        timeoutMs: deps.config.REQUEST_TIMEOUT_MS,
        signal: deps.signal,
      });
      // Success opening upstream stream → commit (no more failover)
      recordAttempt(deps.metrics, result.provider, "success");
      const modelUsed =
        attempt.logicalModel === primary.id && primary.aliasRequested
          ? logicalOut
          : result.modelUsed;
      deps.logger.info("chat_stream_committed", {
        request_id: deps.requestId,
        model: modelUsed,
        provider: result.provider,
        attempt: attempt.n,
        credential_mode: cred.mode,
      });
      return {
        stream: mapStreamModel(result.stream, modelUsed),
        modelUsed,
        provider: result.provider,
        endpointId: result.endpointId,
        attemptCount: attempt.n,
        startedAt: result.startedAt,
        credentialMode: cred.mode,
      };
    } catch (e) {
      const pe = getProviderError(e) as ProviderError | undefined;
      const cls = pe ? adapter.classifyError(pe) : "retriable";
      lastError = pe?.message ?? (e instanceof Error ? e.message : "unknown error");
      recordAttempt(
        deps.metrics,
        attempt.provider,
        pe && !isRetriable(cls) ? "error" : "retriable",
      );
      deps.logger.warn("chat_stream_attempt_failed", {
        request_id: deps.requestId,
        attempt: attempt.n,
        provider: attempt.provider,
        status: pe?.status,
        class: cls,
        message: lastError,
      });
      if (pe && !isRetriable(cls)) {
        throw openaiError(400, lastError, "upstream_error");
      }
    }
  }

  throw openaiError(
    502,
    lastError ? `All upstream attempts failed: ${lastError}` : "All upstream attempts failed",
    "upstream_unavailable",
  );
}

function adapterFor(provider: string, apiKey: string, baseUrl: string): ChatAdapter | null {
  if (provider === "openai") {
    return createOpenAIAdapter({ apiKey, baseUrl });
  }
  if (provider === "anthropic") {
    return createAnthropicAdapter({ apiKey, baseUrl });
  }
  if (provider === "xai" || provider === "grok") {
    return createXaiAdapter({ apiKey, baseUrl });
  }
  return null;
}

async function* mapStreamModel(
  stream: AsyncIterable<ChatCompletionChunk>,
  model: string,
): AsyncIterable<ChatCompletionChunk> {
  for await (const chunk of stream) {
    yield { ...chunk, model };
  }
}
