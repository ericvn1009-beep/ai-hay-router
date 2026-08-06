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
import { resetMetricsForTests } from "../../observability/metrics.js";
import { loadRegistryFromYaml } from "../../registry/load.js";

function testApp() {
  resetMetricsForTests();
  const config = loadConfig({
    FEATURE_CONTROL_PLANE: "true",
    FEATURE_METRICS: "false",
    FEATURE_COMPLETION_LOGS: "false",
    FEATURE_BYOK: "true",
    FEATURE_CREDITS: "true",
    FEATURE_TOOLS_VISION: "true",
    SESSION_SECRET: "test-session-secret",
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test-pepper",
    BYOK_MASTER_KEY: "test-byok-master",
    STRIPE_WEBHOOK_SECRET: "whsec-test",
    STORE_DRIVER: "memory",
  } as unknown as NodeJS.ProcessEnv);

  const cfg = {
    ...config,
    FEATURE_CONTROL_PLANE: true,
    FEATURE_METRICS: false,
    FEATURE_COMPLETION_LOGS: false,
    FEATURE_OTEL: false,
    FEATURE_ALIASES: true,
    FEATURE_BUDGETS: true,
    FEATURE_BYOK: true,
    FEATURE_CREDITS: true,
    CREDITS_BYOK_BYPASS: true,
    FEATURE_TOOLS_VISION: true,
    BYOK_MASTER_KEY: "test-byok-master",
    STRIPE_WEBHOOK_SECRET: "whsec-test",
    SESSION_SECRET: "test-session-secret",
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test-pepper",
    STORE_DRIVER: "memory" as const,
    LOG_LEVEL: "error" as const,
    PORT: 3000,
    SERVICE_NAME: "test",
    INSTANCE_ID: "t1",
    DATABASE_URL: "",
    REDIS_URL: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    XAI_API_KEY: "",
    REQUEST_TIMEOUT_MS: 5000,
    DEFAULT_MAX_TOKENS: 100,
    MAX_ATTEMPTS: 3,
    DEFAULT_RPM: 1000,
  };

  const mem = createMemoryStores(cfg.AIHAY_KEY_PEPPER);
  const tenancy = createMemoryTenancyStore(mem.keys);
  const budgets = createMemoryBudgetStore();
  const secrets = createMemorySecretStore(
    resolveMasterKey({ masterKey: cfg.BYOK_MASTER_KEY, pepper: cfg.AIHAY_KEY_PEPPER }),
  );
  const wallets = createMemoryWalletStore();
  const app = createApp({
    config: cfg,
    registry: loadRegistryFromYaml(),
    logger: createLogger("error"),
    keys: mem.keys,
    usage: mem.usage,
    tenancy,
    budgets,
    secrets,
    wallets,
    rateLimiter: createMemoryRateLimiter(),
    metrics: null,
  });
  return { app, mem, tenancy, budgets, secrets, wallets, cfg };
}

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

describe("control plane", () => {
  it("exposes catalog and rejects API keys on control routes", async () => {
    const { app } = testApp();
    const cat = await app.request("/control/v1");
    expect(cat.status).toBe(200);

    const me = await app.request("/control/v1/me", {
      headers: { Authorization: "Bearer sk-aihay-dev-local" },
    });
    expect(me.status).toBe(401);
  });

  it("register → create key → use on data plane", async () => {
    const { app } = testApp();
    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "password123",
        name: "Owner",
      }),
    });
    expect(reg.status).toBe(200);
    const regBody = (await reg.json()) as {
      workspace_id: string;
      user: { email: string };
    };
    expect(regBody.user.email).toBe("owner@example.com");
    const cookie = cookieFrom(reg);
    expect(cookie.startsWith("aihay_session=")).toBe(true);

    const keyRes = await app.request(
      `/control/v1/workspaces/${regBody.workspace_id}/keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ name: "ci-key" }),
      },
    );
    expect(keyRes.status).toBe(201);
    const keyBody = (await keyRes.json()) as { secret: string; prefix: string };
    expect(keyBody.secret.startsWith("sk-aihay-")).toBe(true);

    const models = await app.request("/v1/models", {
      headers: { Authorization: `Bearer ${keyBody.secret}` },
    });
    expect(models.status).toBe(200);
  });

  it("viewer cannot create keys", async () => {
    const { app, tenancy, mem } = testApp();
    // owner
    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "boss@example.com",
        password: "password123",
      }),
    });
    const regBody = (await reg.json()) as {
      workspace_id: string;
      organization_id: string;
    };
    const ownerCookie = cookieFrom(reg);

    // invite viewer
    const inv = await app.request(
      `/control/v1/organizations/${regBody.organization_id}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: "view@example.com", role: "viewer" }),
      },
    );
    expect(inv.status).toBe(201);

    // register viewer (joins via invite)
    const viewReg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "view@example.com",
        password: "password123",
      }),
    });
    expect(viewReg.status).toBe(200);
    const viewCookie = cookieFrom(viewReg);

    const denied = await app.request(
      `/control/v1/workspaces/${regBody.workspace_id}/keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: viewCookie,
        },
        body: JSON.stringify({ name: "nope" }),
      },
    );
    expect(denied.status).toBe(403);

    // can still list usage as viewer
    const usage = await app.request(
      `/control/v1/workspaces/${regBody.workspace_id}/usage`,
      { headers: { Cookie: viewCookie } },
    );
    expect(usage.status).toBe(200);
    void tenancy;
    void mem;
  });

  it("login works after register", async () => {
    const { app } = testApp();
    await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "a@example.com",
        password: "password123",
      }),
    });
    const login = await app.request("/control/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "a@example.com",
        password: "password123",
      }),
    });
    expect(login.status).toBe(200);
    expect(cookieFrom(login).startsWith("aihay_session=")).toBe(true);
  });

  it("BYOK put/list/delete never returns secret material", async () => {
    const { app } = testApp();
    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "byok@example.com",
        password: "password123",
      }),
    });
    const { workspace_id } = (await reg.json()) as { workspace_id: string };
    const cookie = cookieFrom(reg);

    const put = await app.request(
      `/control/v1/workspaces/${workspace_id}/providers/openai/secret`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ api_key: "sk-live-super-secret-key-xyz" }),
      },
    );
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(JSON.stringify(putBody)).not.toContain("sk-live-super-secret-key-xyz");
    expect((putBody as { configured: boolean }).configured).toBe(true);
    expect((putBody as { key_hint: string }).key_hint).toMatch(/…/);

    const list = await app.request(`/control/v1/workspaces/${workspace_id}/providers`, {
      headers: { Cookie: cookie },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      enabled: boolean;
      providers: Array<{ provider: string; configured: boolean }>;
    };
    expect(listBody.enabled).toBe(true);
    expect(listBody.providers.find((p) => p.provider === "openai")?.configured).toBe(true);
    expect(JSON.stringify(listBody)).not.toContain("sk-live-super-secret-key-xyz");

    const del = await app.request(
      `/control/v1/workspaces/${workspace_id}/providers/openai/secret`,
      { method: "DELETE", headers: { Cookie: cookie } },
    );
    expect(del.status).toBe(200);
    const after = await app.request(`/control/v1/workspaces/${workspace_id}/providers`, {
      headers: { Cookie: cookie },
    });
    const afterBody = (await after.json()) as {
      providers: Array<{ provider: string; configured: boolean }>;
    };
    expect(afterBody.providers.find((p) => p.provider === "openai")?.configured).toBe(false);
  });

  it("wallet credit + webhook idempotency", async () => {
    const { app } = testApp();
    const reg = await app.request("/control/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "wallet@example.com",
        password: "password123",
      }),
    });
    const { workspace_id } = (await reg.json()) as { workspace_id: string };
    const cookie = cookieFrom(reg);

    const credit = await app.request(
      `/control/v1/workspaces/${workspace_id}/wallet/credit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          amount_usd: 25,
          idempotency_key: "manual-1",
          reason: "promo",
        }),
      },
    );
    expect(credit.status).toBe(200);
    const creditBody = (await credit.json()) as { balance_usd: number; replayed: boolean };
    expect(creditBody.balance_usd).toBe(25);
    expect(creditBody.replayed).toBe(false);

    const again = await app.request(
      `/control/v1/workspaces/${workspace_id}/wallet/credit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          amount_usd: 25,
          idempotency_key: "manual-1",
        }),
      },
    );
    expect((await again.json() as { replayed: boolean }).replayed).toBe(true);

    const hook = await app.request("/control/v1/webhooks/credits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Credits-Webhook-Secret": "whsec-test",
      },
      body: JSON.stringify({
        event_id: "evt_stripe_1",
        workspace_id,
        amount_usd: 10,
      }),
    });
    expect(hook.status).toBe(200);
    expect((await hook.json() as { balance_usd: number }).balance_usd).toBe(35);

    const hookReplay = await app.request("/control/v1/webhooks/credits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Credits-Webhook-Secret": "whsec-test",
      },
      body: JSON.stringify({
        event_id: "evt_stripe_1",
        workspace_id,
        amount_usd: 10,
      }),
    });
    expect((await hookReplay.json() as { replayed: boolean }).replayed).toBe(true);

    const bal = await app.request(`/control/v1/workspaces/${workspace_id}/wallet`, {
      headers: { Cookie: cookie },
    });
    expect(bal.status).toBe(200);
    expect((await bal.json() as { balance_usd: number }).balance_usd).toBe(35);
  });
});
