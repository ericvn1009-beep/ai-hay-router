import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { bootstrapStores } from "./bootstrap.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { loadRegistryFromYaml } from "./registry/load.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const registry = loadRegistryFromYaml();

const stores = await bootstrapStores(config, logger);

const app = createApp({
  config,
  registry,
  logger,
  keys: stores.keys,
  usage: stores.usage,
  rateLimiter: stores.rateLimiter,
  readyCheckDb: stores.ready,
});

logger.info("aihay_starting", {
  port: config.PORT,
  models: registry.size,
  store: stores.driver,
  openai_configured: Boolean(config.OPENAI_API_KEY),
  anthropic_configured: Boolean(config.ANTHROPIC_API_KEY),
  xai_configured: Boolean(config.XAI_API_KEY),
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
