import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppConfig } from "../config.js";
import type { BudgetStore } from "../db/budget-types.js";
import type { ProviderSecretStore } from "../db/secret-types.js";
import type { UsageStore } from "../db/types.js";
import type { WalletStore } from "../db/wallet-types.js";
import { isByokProvider, type ByokProvider } from "../crypto/byok.js";
import { AppError, openaiError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import type { RateLimiter } from "../lib/rate-limit.js";
import { buildUsageEvent, enqueueUsage } from "../metering/usage.js";
import type { Metrics } from "../observability/metrics.js";
import {
  logRequestComplete,
  recordRequestCompleteMetrics,
  type RequestCompleteEvent,
} from "../observability/request-complete.js";
import { handleChatNonStream, handleChatStream } from "../pipeline/handle-chat.js";
import { resolveModel } from "../registry/resolve.js";
import type { ModelRecord } from "../registry/types.js";
import { validateAndNormalizeChat } from "./schemas.js";

const ROUTE = "/v1/chat/completions";

export function chatRoutes(opts: {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
  usage: UsageStore;
  rateLimiter: RateLimiter;
  metrics: Metrics | null;
  budgets: BudgetStore | null;
  secrets: ProviderSecretStore | null;
  wallets: WalletStore | null;
}) {
  const r = new Hono();

  r.post("/v1/chat/completions", async (c) => {
    const requestId = c.get("requestId");
    const apiKey = c.get("apiKey");
    const startedAt = Date.now();
    const body = await c.req.json();

    const emitComplete = (
      partial: Omit<
        RequestCompleteEvent,
        "request_id" | "workspace_id" | "api_key_id" | "route" | "credential_mode"
      > & { credential_mode?: RequestCompleteEvent["credential_mode"] },
    ) => {
      const event: RequestCompleteEvent = {
        request_id: requestId,
        workspace_id: apiKey.workspaceId,
        api_key_id: apiKey.id,
        route: ROUTE,
        ...partial,
        credential_mode: partial.credential_mode ?? "platform",
      };
      logRequestComplete(opts.logger, opts.config.FEATURE_COMPLETION_LOGS, event);
      recordRequestCompleteMetrics(opts.metrics, event);
    };

    const requestedModel =
      typeof (body as { model?: string })?.model === "string"
        ? (body as { model: string }).model
        : "unknown";

    let modelRecord: ModelRecord | undefined;
    try {
      if (requestedModel !== "unknown") {
        modelRecord = resolveModel(opts.registry, requestedModel, {
          aliasesEnabled: opts.config.FEATURE_ALIASES,
        });
      }
    } catch {
      modelRecord = opts.registry.get(requestedModel);
    }

    let input;
    try {
      input = validateAndNormalizeChat(body, {
        defaultMaxTokens: opts.config.DEFAULT_MAX_TOKENS,
        toolsVisionEnabled: opts.config.FEATURE_TOOLS_VISION,
        model: modelRecord ?? null,
      });
    } catch (e) {
      const errorCode =
        e instanceof AppError ? (e.code ?? e.message.slice(0, 120)) : "invalid_request";
      const httpStatus = e instanceof AppError ? Number(e.status) : 400;
      emitComplete({
        stream: Boolean((body as { stream?: boolean })?.stream),
        model_requested: requestedModel,
        model_used: requestedModel,
        provider: "none",
        status: "error",
        http_status: httpStatus,
        latency_ms: Date.now() - startedAt,
        ttft_ms: null,
        attempt_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd_estimate: 0,
        error_code: errorCode,
      });
      throw e;
    }

    const signal = c.req.raw.signal;

    // V2.4 budgets
    if (opts.config.FEATURE_BUDGETS && opts.budgets && apiKey.workspaceId !== "dev-workspace") {
      const check = await opts.budgets.check(apiKey.workspaceId);
      if (!check.allowed) {
        c.header("Retry-After", "3600");
        emitComplete({
          stream: Boolean(input.stream),
          model_requested: input.model,
          model_used: input.model,
          provider: "none",
          status: "error",
          http_status: 429,
          latency_ms: Date.now() - startedAt,
          ttft_ms: null,
          attempt_count: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          cost_usd_estimate: 0,
          error_code: "budget_exceeded",
        });
        throw openaiError(429, check.reason ?? "Budget exceeded", "budget_exceeded");
      }
      if (check.softWarning) {
        opts.logger.warn("budget_soft_warning", {
          request_id: requestId,
          workspace_id: apiKey.workspaceId,
          usage: check.usage,
        });
      }
    }

    // V2.6 credits pre-check (platform path; BYOK can bypass)
    let chargeCredits = false;
    if (
      opts.config.FEATURE_CREDITS &&
      opts.wallets &&
      apiKey.workspaceId !== "dev-workspace"
    ) {
      const provider = modelRecord?.provider;
      let byokConfigured = false;
      if (
        opts.config.CREDITS_BYOK_BYPASS &&
        opts.secrets &&
        provider &&
        isByokProvider(provider)
      ) {
        const meta = await opts.secrets.getMeta(
          apiKey.workspaceId,
          provider as ByokProvider,
        );
        byokConfigured = Boolean(meta);
      }
      if (!byokConfigured) {
        const spend = await opts.wallets.canSpend(apiKey.workspaceId);
        if (!spend.allowed) {
          emitComplete({
            stream: Boolean(input.stream),
            model_requested: input.model,
            model_used: input.model,
            provider: "none",
            status: "error",
            http_status: 402,
            latency_ms: Date.now() - startedAt,
            ttft_ms: null,
            attempt_count: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            cost_usd_estimate: 0,
            error_code: "insufficient_credits",
          });
          throw openaiError(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            402 as any,
            spend.reason ?? "Insufficient credits",
            "insufficient_credits",
          );
        }
        chargeCredits = true;
      }
    }

    const trackBudget = (cost: number, tokens: number) => {
      if (
        opts.config.FEATURE_BUDGETS &&
        opts.budgets &&
        apiKey.workspaceId !== "dev-workspace" &&
        (cost > 0 || tokens > 0)
      ) {
        void opts.budgets.addUsage(apiKey.workspaceId, cost, tokens).catch((e) => {
          opts.logger.warn("budget_add_failed", {
            request_id: requestId,
            message: e instanceof Error ? e.message : String(e),
          });
        });
      }
    };

    const trackCredits = (cost: number, credentialMode: "platform" | "byok") => {
      if (!chargeCredits || !opts.wallets || cost <= 0) return;
      if (credentialMode === "byok" && opts.config.CREDITS_BYOK_BYPASS) return;
      void opts.wallets
        .debit(apiKey.workspaceId, cost, {
          requestId,
          reason: "inference",
        })
        .then((r) => {
          if (!r.allowed) {
            opts.logger.warn("credit_debit_insufficient_after_success", {
              request_id: requestId,
              reason: r.reason,
            });
          }
        })
        .catch((e) => {
          opts.logger.warn("credit_debit_failed", {
            request_id: requestId,
            message: e instanceof Error ? e.message : String(e),
          });
        });
    };

    if (input.stream) {
      let result;
      try {
        result = await handleChatStream(input, {
          config: opts.config,
          registry: opts.registry,
          logger: opts.logger,
          requestId,
          workspaceId: apiKey.workspaceId,
          secrets: opts.secrets,
          signal,
          metrics: opts.metrics,
        });
      } catch (e) {
        const errorCode = e instanceof Error ? e.message.slice(0, 120) : "error";
        const httpStatus = e instanceof AppError ? Number(e.status) : 502;
        const usage = buildUsageEvent({
          requestId,
          apiKeyId: apiKey.id,
          workspaceId: apiKey.workspaceId,
          modelRequested: input.model,
          modelUsed: input.model,
          provider: "none",
          endpointId: null,
          promptTokens: 0,
          completionTokens: 0,
          usageEstimated: true,
          latencyMs: Date.now() - startedAt,
          ttftMs: null,
          status: "error",
          errorCode,
          attemptCount: 0,
          modelRecord,
        });
        enqueueUsage(opts.usage, usage, opts.logger, opts.metrics);
        emitComplete({
          stream: true,
          model_requested: input.model,
          model_used: input.model,
          provider: "none",
          status: "error",
          http_status: httpStatus,
          latency_ms: usage.latencyMs,
          ttft_ms: null,
          attempt_count: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          cost_usd_estimate: usage.costUsdEstimate,
          error_code: errorCode,
        });
        throw e;
      }

      c.header("x-aihay-model", result.modelUsed);
      c.header("x-aihay-provider", result.provider);
      c.header("x-request-id", requestId);
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      return streamSSE(c, async (stream) => {
        let promptTokens = 0;
        let completionTokens = 0;
        let usageEstimated = true;
        let ttftMs: number | null = null;
        let status: "success" | "error" | "aborted" = "success";
        let errorCode: string | null = null;
        let httpStatus = 200;

        try {
          for await (const chunk of result.stream) {
            if (ttftMs === null) ttftMs = Date.now() - result.startedAt;
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens;
              completionTokens = chunk.usage.completion_tokens;
              usageEstimated = false;
            }
            await stream.writeSSE({ data: JSON.stringify(chunk) });
          }
          await stream.writeSSE({ data: "[DONE]" });
        } catch (e) {
          status = signal.aborted ? "aborted" : "error";
          httpStatus = signal.aborted ? 499 : 500;
          errorCode = e instanceof Error ? e.message.slice(0, 120) : "stream_error";
          opts.logger.error("stream_proxy_error", {
            request_id: requestId,
            message: errorCode,
          });
          try {
            await stream.writeSSE({
              data: JSON.stringify({
                error: {
                  message: errorCode,
                  type: "api_error",
                  code: "stream_error",
                },
              }),
            });
          } catch {
            /* client gone */
          }
        } finally {
          const usedModel = opts.registry.get(result.modelUsed) ?? modelRecord;
          const totalTokens = promptTokens + completionTokens;
          if (totalTokens > 0) {
            void opts.rateLimiter.addDailyTokens(apiKey.id, totalTokens);
          }
          const latencyMs = Date.now() - result.startedAt;
          const usage = buildUsageEvent({
            requestId,
            apiKeyId: apiKey.id,
            workspaceId: apiKey.workspaceId,
            modelRequested: input.model,
            modelUsed: result.modelUsed,
            provider: result.provider,
            endpointId: result.endpointId,
            promptTokens,
            completionTokens,
            usageEstimated,
            latencyMs,
            ttftMs,
            status,
            errorCode,
            attemptCount: result.attemptCount,
            modelRecord: usedModel,
            credentialMode: result.credentialMode,
          });
          enqueueUsage(opts.usage, usage, opts.logger, opts.metrics);
          trackBudget(usage.costUsdEstimate, promptTokens + completionTokens);
          trackCredits(usage.costUsdEstimate, result.credentialMode);
          emitComplete({
            stream: true,
            model_requested: input.model,
            model_used: result.modelUsed,
            provider: result.provider,
            status,
            http_status: httpStatus,
            latency_ms: latencyMs,
            ttft_ms: ttftMs,
            attempt_count: result.attemptCount,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            cost_usd_estimate: usage.costUsdEstimate,
            error_code: errorCode,
            credential_mode: result.credentialMode,
          });
        }
      });
    }

    try {
      const result = await handleChatNonStream(input, {
        config: opts.config,
        registry: opts.registry,
        logger: opts.logger,
        requestId,
        workspaceId: apiKey.workspaceId,
        secrets: opts.secrets,
        signal,
        metrics: opts.metrics,
      });

      const promptTokens = result.completion.usage?.prompt_tokens ?? 0;
      const completionTokens = result.completion.usage?.completion_tokens ?? 0;
      const usageEstimated = !result.completion.usage;
      const usedModel = opts.registry.get(result.modelUsed) ?? modelRecord;

      void opts.rateLimiter.addDailyTokens(apiKey.id, promptTokens + completionTokens);
      const usage = buildUsageEvent({
        requestId,
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspaceId,
        modelRequested: input.model,
        modelUsed: result.modelUsed,
        provider: result.provider,
        endpointId: result.endpointId,
        promptTokens,
        completionTokens,
        usageEstimated,
        latencyMs: result.latencyMs,
        ttftMs: null,
        status: "success",
        errorCode: null,
        attemptCount: result.attemptCount,
        modelRecord: usedModel,
        credentialMode: result.credentialMode,
      });
      enqueueUsage(opts.usage, usage, opts.logger, opts.metrics);
      trackBudget(usage.costUsdEstimate, promptTokens + completionTokens);
      trackCredits(usage.costUsdEstimate, result.credentialMode);
      emitComplete({
        stream: false,
        model_requested: input.model,
        model_used: result.modelUsed,
        provider: result.provider,
        status: "success",
        http_status: 200,
        latency_ms: result.latencyMs,
        ttft_ms: null,
        attempt_count: result.attemptCount,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd_estimate: usage.costUsdEstimate,
        error_code: null,
        credential_mode: result.credentialMode,
      });

      c.header("x-aihay-model", result.modelUsed);
      c.header("x-aihay-provider", result.provider);
      c.header("x-aihay-credential-mode", result.credentialMode);
      c.header("x-request-id", requestId);

      return c.json(result.completion);
    } catch (e) {
      const errorCode = e instanceof Error ? e.message.slice(0, 120) : "error";
      const httpStatus = e instanceof AppError ? Number(e.status) : 502;
      const usage = buildUsageEvent({
        requestId,
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspaceId,
        modelRequested: input.model,
        modelUsed: input.model,
        provider: "none",
        endpointId: null,
        promptTokens: 0,
        completionTokens: 0,
        usageEstimated: true,
        latencyMs: Date.now() - startedAt,
        ttftMs: null,
        status: "error",
        errorCode,
        attemptCount: 0,
        modelRecord,
      });
      enqueueUsage(opts.usage, usage, opts.logger, opts.metrics);
      emitComplete({
        stream: false,
        model_requested: input.model,
        model_used: input.model,
        provider: "none",
        status: "error",
        http_status: httpStatus,
        latency_ms: usage.latencyMs,
        ttft_ms: null,
        attempt_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd_estimate: usage.costUsdEstimate,
        error_code: errorCode,
      });
      throw e;
    }
  });

  return r;
}
