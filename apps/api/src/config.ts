import { z } from "zod";

const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    if (typeof v === "boolean") return v;
    const s = v.toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
    return undefined;
  });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SERVICE_NAME: z.string().default("aihay-api"),
  INSTANCE_ID: z.string().optional().default(""),
  AIHAY_DEV_KEY: z.string().default("sk-aihay-dev-local"),
  AIHAY_KEY_PEPPER: z.string().default("dev-pepper-change-me"),
  SESSION_SECRET: z.string().default("dev-session-secret-change-me"),
  DATABASE_URL: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  STORE_DRIVER: z.enum(["memory", "postgres", "auto"]).default("auto"),
  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  XAI_API_KEY: z.string().optional().default(""),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(120_000),
  DEFAULT_MAX_TOKENS: z.coerce.number().default(4096),
  MAX_ATTEMPTS: z.coerce.number().default(3),
  DEFAULT_RPM: z.coerce.number().default(60),
  FEATURE_COMPLETION_LOGS: boolish,
  FEATURE_METRICS: boolish,
  FEATURE_OTEL: boolish,
  FEATURE_CONTROL_PLANE: boolish,
  FEATURE_ALIASES: boolish,
  FEATURE_BUDGETS: boolish,
  FEATURE_BYOK: boolish,
  /** Base64 (32 bytes) or 64-char hex AES master key; falls back to pepper-derived key in dev */
  BYOK_MASTER_KEY: z.string().optional().default(""),
  FEATURE_CREDITS: boolish,
  /** When true, BYOK traffic skips wallet pre-check/debit */
  CREDITS_BYOK_BYPASS: boolish,
  /** Shared secret for Stripe-style credit webhooks (optional) */
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  FEATURE_TOOLS_VISION: boolish,
});

export type AppConfig = z.infer<typeof envSchema> & {
  FEATURE_COMPLETION_LOGS: boolean;
  FEATURE_METRICS: boolean;
  FEATURE_OTEL: boolean;
  FEATURE_CONTROL_PLANE: boolean;
  FEATURE_ALIASES: boolean;
  FEATURE_BUDGETS: boolean;
  FEATURE_BYOK: boolean;
  FEATURE_CREDITS: boolean;
  CREDITS_BYOK_BYPASS: boolean;
  FEATURE_TOOLS_VISION: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    FEATURE_COMPLETION_LOGS: parsed.FEATURE_COMPLETION_LOGS ?? true,
    FEATURE_METRICS: parsed.FEATURE_METRICS ?? true,
    FEATURE_OTEL: parsed.FEATURE_OTEL ?? false,
    FEATURE_CONTROL_PLANE: parsed.FEATURE_CONTROL_PLANE ?? true,
    FEATURE_ALIASES: parsed.FEATURE_ALIASES ?? true,
    FEATURE_BUDGETS: parsed.FEATURE_BUDGETS ?? true,
    FEATURE_BYOK: parsed.FEATURE_BYOK ?? false,
    FEATURE_CREDITS: parsed.FEATURE_CREDITS ?? false,
    CREDITS_BYOK_BYPASS: parsed.CREDITS_BYOK_BYPASS ?? true,
    FEATURE_TOOLS_VISION: parsed.FEATURE_TOOLS_VISION ?? false,
  };
}

export function resolveStoreDriver(config: AppConfig): "memory" | "postgres" {
  if (config.STORE_DRIVER === "memory") return "memory";
  if (config.STORE_DRIVER === "postgres") return "postgres";
  return config.DATABASE_URL ? "postgres" : "memory";
}
