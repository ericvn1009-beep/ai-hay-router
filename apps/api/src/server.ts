import { serve } from "@hono/node-server";
import { hostname } from "node:os";
import { createApp } from "./app.js";
import { bootstrapStores } from "./bootstrap.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { getOrCreateMetrics } from "./observability/metrics.js";
import { createOtelHooks } from "./observability/otel.js";
import { loadRegistryFromYaml } from "./registry/load.js";

const config = loadConfig();
const instanceId = config.INSTANCE_ID || process.env.HOSTNAME || hostname();
const logger = createLogger({
  minLevel: config.LOG_LEVEL,
  service: config.SERVICE_NAME,
  instanceId,
});
const registry = loadRegistryFromYaml();
const metrics = getOrCreateMetrics(config.FEATURE_METRICS, config.SERVICE_NAME);
const otel = createOtelHooks(config.FEATURE_OTEL);

const stores = await bootstrapStores(config, logger);

const app = createApp({
  config,
  registry,
  logger,
  keys: stores.keys,
  usage: stores.usage,
  tenancy: stores.tenancy,
  budgets: stores.budgets,
  secrets: stores.secrets,
  wallets: stores.wallets,
  rateLimiter: stores.rateLimiter,
  metrics,
  readyCheckDb: stores.ready,
});

logger.info("aihay_starting", {
  port: config.PORT,
  models: registry.size,
  store: stores.driver,
  openai_configured: Boolean(config.OPENAI_API_KEY),
  anthropic_configured: Boolean(config.ANTHROPIC_API_KEY),
  xai_configured: Boolean(config.XAI_API_KEY),
  feature_completion_logs: config.FEATURE_COMPLETION_LOGS,
  feature_metrics: config.FEATURE_METRICS,
  feature_otel: config.FEATURE_OTEL,
  feature_control_plane: config.FEATURE_CONTROL_PLANE,
  feature_aliases: config.FEATURE_ALIASES,
  feature_budgets: config.FEATURE_BUDGETS,
  feature_byok: config.FEATURE_BYOK,
  feature_credits: config.FEATURE_CREDITS,
  feature_tools_vision: config.FEATURE_TOOLS_VISION,
  otel_enabled: otel.enabled,
});

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  logger.info("aihay_listening", { port: info.port });
});

async function shutdown() {
  logger.info("aihay_shutdown");
  await stores.close();
  server.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
