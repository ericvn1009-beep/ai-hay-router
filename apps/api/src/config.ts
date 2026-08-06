import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  AIHAY_DEV_KEY: z.string().default("sk-aihay-dev-local"),
  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(120_000),
  DEFAULT_MAX_TOKENS: z.coerce.number().default(4096),
  MAX_ATTEMPTS: z.coerce.number().default(3),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
