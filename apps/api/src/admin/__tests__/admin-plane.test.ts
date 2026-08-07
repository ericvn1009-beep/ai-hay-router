import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { loadConfig } from "../../config.js";
import { resolveMasterKey } from "../../crypto/byok.js";
import { createMemoryBudgetStore } from "../../db/memory-budget.js";
import { createMemorySecretStore } from "../../db/memory-secrets.js";
import { createMemoryStores } from "../../db/memory-store.js";
import { createMemoryTenancyStore } from "../../db/memory-tenancy.js";
import { createMemoryWalletStore } from "../../db/memory-wallet.js";
import { createLogger } from "../../lib/logger.js";
import { createMemoryRateLimiter } from "../../lib/rate-limit.js";
import { loadRegistryFromYaml } from "../../registry/load.js";

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

function testApp() {
  const config = loadConfig({
    FEATURE_CONTROL_PLANE: "true",
    FEATURE_PLATFORM_ADMIN: "true",
    PLATFORM_ADMIN_BOOTSTRAP_EMAIL: "admin@example.com",
    STORE_DRIVER: "memory",
    AIHAY_KEY_PEPPER: "p",
    SESSION_SECRET: "s",
  } as unknown as NodeJS.ProcessEnv);

  const cfg = {
    ...config,
    FEATURE_PLATFORM_ADMIN: true,
    FEATURE_CONTROL_PLANE: true,
    FEATURE_BYOK: false,
    FEATURE_CREDITS: true,
    FEATURE_BUDGETS: true,
    FEATURE_ALIASES: true,
    FEATURE_TOOLS_VISION: false,
    FEATURE_METRICS: false,
    FEATURE_COMPLETION_LOGS: false,
    FEATURE_OTEL: false,
    CREDITS_BYOK_BYPASS: true,
    PLATFORM_ADMIN_BOOTSTRAP_EMAIL: "admin@example.com",
    PUBLIC_API_BASE_URL: "https://api.example.com/v1",
    GRAFANA_URL: "http://localhost:3002",
    BYOK_MASTER_KEY: "m",
    STRIPE_WEBHOOK_SECRET: "",
  };

  const mem = createMemoryStores(cfg.AIHAY_KEY_PEPPER);
  const tenancy = createMemoryTenancyStore(mem.keys);
  const app = createApp({
    config: cfg,
    registry: loadRegistryFromYaml(),
    logger: createLogger("error"),
    keys: mem.keys,
    usage: mem.usage,
    tenancy,
    budgets: createMemoryBudgetStore(),
    secrets: createMemorySecretStore(
      resolveMasterKey({ masterKey: "m", pepper: "p" }),
    ),
    wallets: createMemoryWalletStore(),
    rateLimiter: createMemoryRateLimiter(),
    metrics: null,
  });
  return { app, tenancy };
}

describe("admin plane", () => {
  it("promotes bootstrap email and isolates non-admins", async () => {
    const { app } = testApp();

    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "password123",
      }),
    });
    expect(reg.status).toBe(200);
    const adminCookie = cookieFrom(reg);

    const me = await app.request("/control/v1/me", {
      headers: { Cookie: adminCookie },
    });
    const meBody = (await me.json()) as { user: { platform_admin: boolean } };
    expect(meBody.user.platform_admin).toBe(true);

    const health = await app.request("/admin/v1/health", {
      headers: { Cookie: adminCookie },
    });
    expect(health.status).toBe(200);

    const reg2 = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
    });
    const userCookie = cookieFrom(reg2);
    const denied = await app.request("/admin/v1/workspaces", {
      headers: { Cookie: userCookie },
    });
    expect(denied.status).toBe(403);
  });

  it("exposes models catalog without API key", async () => {
    const { app } = testApp();
    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "u2@example.com",
        password: "password123",
      }),
    });
    const cookie = cookieFrom(reg);
    const models = await app.request("/control/v1/models", {
      headers: { Cookie: cookie },
    });
    expect(models.status).toBe(200);
    const body = (await models.json()) as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
  });
});
