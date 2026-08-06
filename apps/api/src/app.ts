import { Hono } from "hono";
import type { AppConfig } from "./config.js";
import type { Logger } from "./lib/logger.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import type { ModelRecord } from "./registry/types.js";
import { chatRoutes } from "./routes/chat-completions.js";
import { healthRoutes } from "./routes/health.js";
import { modelsRoutes } from "./routes/models.js";

export function createApp(opts: {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
}) {
  const app = new Hono();

  app.use("*", requestIdMiddleware);
  app.onError(createErrorHandler(opts.logger));

  app.route("/", healthRoutes());

  // Authenticated API
  const api = new Hono();
  api.use("*", createAuthMiddleware(opts.config.AIHAY_DEV_KEY));
  api.route("/", modelsRoutes(opts.registry));
  api.route(
    "/",
    chatRoutes({
      config: opts.config,
      registry: opts.registry,
      logger: opts.logger,
    }),
  );

  app.route("/", api);

  return app;
}
