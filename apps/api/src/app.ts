import { Hono } from "hono";
import type { AppConfig } from "./config.js";
import type { KeyStore, UsageStore } from "./db/types.js";
import type { Logger } from "./lib/logger.js";
import type { RateLimiter } from "./lib/rate-limit.js";
import type { Metrics } from "./observability/metrics.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import type { ModelRecord } from "./registry/types.js";
import { chatRoutes } from "./routes/chat-completions.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes } from "./routes/metrics.js";
import { modelsRoutes } from "./routes/models.js";

export interface AppDeps {
  config: AppConfig;
  registry: Map<string, ModelRecord>;
  logger: Logger;
  keys: KeyStore;
  usage: UsageStore;
  rateLimiter: RateLimiter;
  metrics: Metrics | null;
  /** When true, /ready checks are soft (memory mode). */
  readyCheckDb?: () => Promise<boolean>;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use("*", requestIdMiddleware);
  app.onError(createErrorHandler(deps.logger));

  // Unauthenticated ops endpoints
  app.route(
    "/",
    healthRoutes({
      ready: deps.readyCheckDb,
    }),
  );
  app.route("/", metricsRoutes(deps.metrics));

  const api = new Hono();
  api.use(
    "*",
    createAuthMiddleware({
      keyStore: deps.keys,
      pepper: deps.config.AIHAY_KEY_PEPPER,
      devKey: deps.config.AIHAY_DEV_KEY,
      rateLimiter: deps.rateLimiter,
      defaultRpm: deps.config.DEFAULT_RPM,
    }),
  );
  api.route("/", modelsRoutes(deps.registry));
  api.route(
    "/",
    chatRoutes({
      config: deps.config,
      registry: deps.registry,
      logger: deps.logger,
      usage: deps.usage,
      rateLimiter: deps.rateLimiter,
      metrics: deps.metrics,
    }),
  );

  app.route("/", api);
  return app;
}
