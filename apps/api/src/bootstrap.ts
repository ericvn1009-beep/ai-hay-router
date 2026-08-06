import { Redis } from "ioredis";
import type { AppConfig } from "./config.js";
import { resolveStoreDriver } from "./config.js";
import { resolveMasterKey } from "./crypto/byok.js";
import type { BudgetStore } from "./db/budget-types.js";
import { createMemoryBudgetStore } from "./db/memory-budget.js";
import { createMemorySecretStore } from "./db/memory-secrets.js";
import { createMemoryStores } from "./db/memory-store.js";
import { createMemoryTenancyStore } from "./db/memory-tenancy.js";
import { createPgBudgetStore } from "./db/pg-budget.js";
import { createPgSecretStore } from "./db/pg-secrets.js";
import { createPgPool, createPgStores, migrate } from "./db/pg-store.js";
import { createPgTenancyStore } from "./db/pg-tenancy.js";
import type { ProviderSecretStore } from "./db/secret-types.js";
import type { KeyStore, UsageStore } from "./db/types.js";
import type { TenancyStore } from "./db/tenancy-types.js";
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
  tenancy: TenancyStore;
  budgets: BudgetStore;
  secrets: ProviderSecretStore;
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
  let tenancy: TenancyStore;
  let pool: pg.Pool | null = null;

  if (driver === "postgres") {
    if (!config.DATABASE_URL) {
      throw new Error("DATABASE_URL required when STORE_DRIVER=postgres");
    }
    pool = await createPgPool(config.DATABASE_URL);
    const applied = await migrate(pool);
    const stores = createPgStores(pool, config.AIHAY_KEY_PEPPER);
    keys = stores.keys;
    usage = stores.usage;
    tenancy = createPgTenancyStore(pool, keys);
    const boot = await keys.ensureTenancyBootstrap();
    logger.info("store_postgres", {
      migrated: true,
      migrations_applied: applied,
      default_workspace_id: boot.workspaceId,
      default_organization_id: boot.organizationId,
    });
  } else {
    const mem = createMemoryStores(config.AIHAY_KEY_PEPPER);
    keys = mem.keys;
    usage = mem.usage;
    tenancy = createMemoryTenancyStore(keys);
    const boot = await keys.ensureTenancyBootstrap();
    logger.info("store_memory", {
      note: "set DATABASE_URL for postgres",
      default_workspace_id: boot.workspaceId,
      default_organization_id: boot.organizationId,
    });
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

  const budgets: BudgetStore =
    driver === "postgres" && pool
      ? createPgBudgetStore(pool, rateLimiter)
      : createMemoryBudgetStore();

  const masterKey = resolveMasterKey({
    masterKey: config.BYOK_MASTER_KEY,
    pepper: config.AIHAY_KEY_PEPPER,
  });
  if (config.FEATURE_BYOK && !config.BYOK_MASTER_KEY) {
    logger.warn("byok_master_key_missing", {
      note: "Using pepper-derived key; set BYOK_MASTER_KEY for production",
    });
  }
  const secrets: ProviderSecretStore =
    driver === "postgres" && pool
      ? createPgSecretStore(pool, masterKey)
      : createMemorySecretStore(masterKey);

  return {
    keys,
    usage,
    tenancy,
    budgets,
    secrets,
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
