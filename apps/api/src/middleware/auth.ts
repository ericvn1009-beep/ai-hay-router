import { createMiddleware } from "hono/factory";
import type { ApiKeyRecord, KeyStore } from "../db/types.js";
import { hashApiKey, looksLikeAihayKey } from "../lib/hash.js";
import { openaiError } from "../lib/errors.js";
import type { RateLimiter } from "../lib/rate-limit.js";

export interface AuthEnv {
  keyStore: KeyStore;
  pepper: string;
  /** Optional fixed dev key (memory mode / local) */
  devKey?: string;
  rateLimiter: RateLimiter;
  defaultRpm: number;
}

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    apiKey: ApiKeyRecord;
  }
}

export function createAuthMiddleware(env: AuthEnv) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw openaiError(401, "Missing or invalid Authorization header", "invalid_api_key");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw openaiError(401, "Invalid API key", "invalid_api_key");
    }

    let record: ApiKeyRecord | null = null;

    if (env.devKey && token === env.devKey) {
      record = {
        id: "dev-key",
        workspaceId: "dev-workspace",
        name: "dev",
        keyPrefix: token.slice(0, 16),
        keyHash: "dev",
        rateLimitRpm: env.defaultRpm,
        dailyTokenLimit: null,
        dailyCostUsdLimit: null,
        createdByUserId: null,
        revokedAt: null,
        createdAt: new Date(),
      };
    } else if (looksLikeAihayKey(token)) {
      const hash = hashApiKey(token, env.pepper);
      record = await env.keyStore.findByHash(hash);
    }

    if (!record) {
      throw openaiError(401, "Invalid API key", "invalid_api_key");
    }
    if (record.revokedAt) {
      throw openaiError(401, "API key revoked", "invalid_api_key");
    }

    const rpm = record.rateLimitRpm ?? env.defaultRpm;
    const rl = await env.rateLimiter.checkRpm(record.id, rpm);
    if (!rl.allowed) {
      c.header("Retry-After", "60");
      throw openaiError(429, "Rate limit exceeded", "rate_limit_exceeded");
    }

    if (record.dailyTokenLimit != null) {
      const used = await env.rateLimiter.getDailyTokens(record.id);
      if (used >= record.dailyTokenLimit) {
        throw openaiError(429, "Daily token limit exceeded", "daily_limit_exceeded");
      }
    }

    c.set("apiKey", record);
    await next();
  });
}
