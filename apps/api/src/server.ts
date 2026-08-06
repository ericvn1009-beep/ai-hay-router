import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { loadRegistryFromYaml } from "./registry/load.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const registry = loadRegistryFromYaml();

const app = createApp({ config, registry, logger });

logger.info("aihay_starting", {
  port: config.PORT,
  models: registry.size,
  openai_configured: Boolean(config.OPENAI_API_KEY),
  anthropic_configured: Boolean(config.ANTHROPIC_API_KEY),
});

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  logger.info("aihay_listening", { port: info.port });
});
