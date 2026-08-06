import { Redis } from "ioredis";
import type { AppConfig } from "./config.js";
import { resolveStoreDriver } from "./config.js";
import { createMemoryStores } from "./db/memory-store.js";
import { createPgPool, createPgStores, migrate } from "./db/pg-store.js";
import type { KeyStore, UsageStore } from "./db/types.js";
import type { Logger } from "./lib/logger.js";
import {
  createMemoryRateLimiter,
  createRedisRateLimiter,
  type RateLimiter,
} from "./lib/rate-limit.js";
import type pg from "pg";

export interface RuntimeStores {
  keys: KeyStore;
  usage: UsageStore;
  rateLimiter: RateLimiter;
  pool: pg.Pool | null;
  redis: Redis | null;
  driver: "memory" | "postgres";
  ready: () => Promise<boolean>;
  close: () => Promise<void>;
}

export async function bootstrapStores(
  config: AppConfig,
  logger: Logger,
): Promise<RuntimeStores> {
  const driver = resolveStoreDriver(config);
  let keys: KeyStore;
  let usage: UsageStore;
  let pool: pg.Pool | null = null;

  if (driver === "postgres") {
    if (!config.DATABASE_URL) {
      throw new Error("DATABASE_URL required when STORE_DRIVER=postgres");
    }
    pool = await createPgPool(config.DATABASE_URL);
    await migrate(pool);
    const stores = createPgStores(pool, config.AIHAY_KEY_PEPPER);
    keys = stores.keys;
    usage = stores.usage;
    await keys.ensureDefaultWorkspace();
    logger.info("store_postgres", { migrated: true });
  } else {
    const mem = createMemoryStores(config.AIHAY_KEY_PEPPER);
    keys = mem.keys;
    usage = mem.usage;
    await keys.ensureDefaultWorkspace();
    logger.info("store_memory", { note: "set DATABASE_URL for postgres" });
  }

  let redis: Redis | null = null;
  let rateLimiter: RateLimiter;

  if (config.REDIS_URL) {
    try {
      redis = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redis.connect();
      rateLimiter = createRedisRateLimiter(redis);
      logger.info("redis_connected");
    } catch (e) {
      logger.warn("redis_unavailable_using_memory_limiter", {
        message: e instanceof Error ? e.message : String(e),
      });
      redis = null;
      rateLimiter = createMemoryRateLimiter();
    }
  } else {
    rateLimiter = createMemoryRateLimiter();
    logger.info("rate_limiter_memory");
  }

  return {
    keys,
    usage,
    rateLimiter,
    pool,
    redis,
    driver,
    ready: async () => {
      if (pool) {
        await pool.query("SELECT 1");
      }
      return true;
    },
    close: async () => {
      if (redis) await redis.quit();
      if (pool) await pool.end();
    },
  };
}
