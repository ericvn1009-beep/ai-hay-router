import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppConfig } from "../config.js";
import type { Logger } from "../lib/logger.js";
import { handleChatNonStream, handleChatStream } from "../pipeline/handle-chat.js";
import type { ModelRecord } from "../registry/types.js";
import { validateAndNormalizeChat } from "./schemas.js";

export function chatRoutes(opts: {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
}) {
  const r = new Hono();

  r.post("/v1/chat/completions", async (c) => {
    const requestId = c.get("requestId");
    const body = await c.req.json();
    const input = validateAndNormalizeChat(body, opts.config.DEFAULT_MAX_TOKENS);

    const signal = c.req.raw.signal;

    if (input.stream) {
      const result = await handleChatStream(input, {
        config: opts.config,
        registry: opts.registry,
        logger: opts.logger,
        requestId,
        signal,
      });

      c.header("x-aihay-model", result.modelUsed);
      c.header("x-aihay-provider", result.provider);
      c.header("x-request-id", requestId);
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of result.stream) {
            await stream.writeSSE({
              data: JSON.stringify(chunk),
            });
          }
          await stream.writeSSE({ data: "[DONE]" });
        } catch (e) {
          opts.logger.error("stream_proxy_error", {
            request_id: requestId,
            message: e instanceof Error ? e.message : String(e),
          });
          // Best-effort error event; clients may already have partial content
          await stream.writeSSE({
            data: JSON.stringify({
              error: {
                message: e instanceof Error ? e.message : "stream error",
                type: "api_error",
                code: "stream_error",
              },
            }),
          });
        }
      });
    }

    const result = await handleChatNonStream(input, {
      config: opts.config,
      registry: opts.registry,
      logger: opts.logger,
      requestId,
      signal,
    });

    c.header("x-aihay-model", result.modelUsed);
    c.header("x-aihay-provider", result.provider);
    c.header("x-request-id", requestId);

    return c.json(result.completion);
  });

  return r;
}
