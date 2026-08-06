import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    const requestId = c.get("requestId") ?? "unknown";

    if (err instanceof AppError) {
      logger.warn("request_error", {
        request_id: requestId,
        status: err.status,
        code: err.code,
        message: err.message,
      });
      return c.json(err.toJSON(), err.status);
    }

    logger.error("unhandled_error", {
      request_id: requestId,
      message: err instanceof Error ? err.message : String(err),
    });

    return c.json(
      {
        error: {
          message: "Internal server error",
          type: "api_error",
          code: "internal_error",
          param: null,
        },
      },
      500,
    );
  };
}
