import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Dev-only bypass key when STORE_DRIVER=memory (or always accepted if set and matches). */
  AIHAY_DEV_KEY: z.string().default("sk-aihay-dev-local"),
  AIHAY_KEY_PEPPER: z.string().default("dev-pepper-change-me"),
  DATABASE_URL: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  /** memory | postgres — auto: postgres if DATABASE_URL set */
  STORE_DRIVER: z.enum(["memory", "postgres", "auto"]).default("auto"),
  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  /** xAI Grok platform key */
  XAI_API_KEY: z.string().optional().default(""),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(120_000),
  DEFAULT_MAX_TOKENS: z.coerce.number().default(4096),
  MAX_ATTEMPTS: z.coerce.number().default(3),
  DEFAULT_RPM: z.coerce.number().default(60),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function resolveStoreDriver(config: AppConfig): "memory" | "postgres" {
  if (config.STORE_DRIVER === "memory") return "memory";
  if (config.STORE_DRIVER === "postgres") return "postgres";
  return config.DATABASE_URL ? "postgres" : "memory";
}
