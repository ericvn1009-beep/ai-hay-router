import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppConfig } from "../config.js";
import type { UsageStore } from "../db/types.js";
import type { Logger } from "../lib/logger.js";
import type { RateLimiter } from "../lib/rate-limit.js";
import { buildUsageEvent, enqueueUsage } from "../metering/usage.js";
import { handleChatNonStream, handleChatStream } from "../pipeline/handle-chat.js";
import type { ModelRecord } from "../registry/types.js";
import { validateAndNormalizeChat } from "./schemas.js";

export function chatRoutes(opts: {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
  usage: UsageStore;
  rateLimiter: RateLimiter;
}) {
  const r = new Hono();

  r.post("/v1/chat/completions", async (c) => {
    const requestId = c.get("requestId");
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const input = validateAndNormalizeChat(body, opts.config.DEFAULT_MAX_TOKENS);
    const signal = c.req.raw.signal;
    const modelRecord = opts.registry.get(input.model);

    if (input.stream) {
      let result;
      try {
        result = await handleChatStream(input, {
          config: opts.config,
          registry: opts.registry,
          logger: opts.logger,
          requestId,
          signal,
        });
      } catch (e) {
        enqueueUsage(
          opts.usage,
          buildUsageEvent({
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
            latencyMs: 0,
            ttftMs: null,
            status: "error",
            errorCode: e instanceof Error ? e.message.slice(0, 120) : "error",
            attemptCount: 0,
            modelRecord,
          }),
          opts.logger,
        );
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
          enqueueUsage(
            opts.usage,
            buildUsageEvent({
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
              latencyMs: Date.now() - result.startedAt,
              ttftMs,
              status,
              errorCode,
              attemptCount: result.attemptCount,
              modelRecord: usedModel,
            }),
            opts.logger,
          );
        }
      });
    }

    try {
      const result = await handleChatNonStream(input, {
        config: opts.config,
        registry: opts.registry,
        logger: opts.logger,
        requestId,
        signal,
      });

      const promptTokens = result.completion.usage?.prompt_tokens ?? 0;
      const completionTokens = result.completion.usage?.completion_tokens ?? 0;
      const usageEstimated = !result.completion.usage;
      const usedModel = opts.registry.get(result.modelUsed) ?? modelRecord;

      void opts.rateLimiter.addDailyTokens(apiKey.id, promptTokens + completionTokens);
      enqueueUsage(
        opts.usage,
        buildUsageEvent({
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
        }),
        opts.logger,
      );

      c.header("x-aihay-model", result.modelUsed);
      c.header("x-aihay-provider", result.provider);
      c.header("x-request-id", requestId);

      return c.json(result.completion);
    } catch (e) {
      enqueueUsage(
        opts.usage,
        buildUsageEvent({
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
          latencyMs: 0,
          ttftMs: null,
          status: "error",
          errorCode: e instanceof Error ? e.message.slice(0, 120) : "error",
          attemptCount: 0,
          modelRecord,
        }),
        opts.logger,
      );
      throw e;
    }
  });

  return r;
}
