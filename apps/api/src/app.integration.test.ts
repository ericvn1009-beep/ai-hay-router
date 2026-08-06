import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createMemoryStores } from "./db/memory-store.js";
import { createMemoryTenancyStore } from "./db/memory-tenancy.js";
import { createLogger } from "./lib/logger.js";
import { createMemoryRateLimiter } from "./lib/rate-limit.js";
import { createMetrics, resetMetricsForTests } from "./observability/metrics.js";
import { loadRegistryFromYaml } from "./registry/load.js";

function testApp(flags?: { metrics?: boolean; completionLogs?: boolean }) {
  resetMetricsForTests();
  const config = loadConfig({
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test",
    DEFAULT_MAX_TOKENS: "100",
    DEFAULT_RPM: "1000",
    STORE_DRIVER: "memory",
    FEATURE_METRICS: flags?.metrics === false ? "false" : "true",
    FEATURE_COMPLETION_LOGS: flags?.completionLogs === false ? "false" : "true",
    FEATURE_CONTROL_PLANE: "false",
  } as unknown as NodeJS.ProcessEnv);

  const cfg = {
    ...config,
    DEFAULT_MAX_TOKENS: 100,
    DEFAULT_RPM: 1000,
    PORT: 3000,
    LOG_LEVEL: "error" as const,
    REQUEST_TIMEOUT_MS: 5000,
    MAX_ATTEMPTS: 3,
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    XAI_API_KEY: "",
    DATABASE_URL: "",
    REDIS_URL: "",
    STORE_DRIVER: "memory" as const,
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test",
    SESSION_SECRET: "test-session",
    SERVICE_NAME: "aihay-api-test",
    INSTANCE_ID: "test-instance",
    FEATURE_COMPLETION_LOGS: flags?.completionLogs !== false,
    FEATURE_METRICS: flags?.metrics !== false,
    FEATURE_OTEL: false,
    FEATURE_CONTROL_PLANE: false,
  };
  const mem = createMemoryStores(cfg.AIHAY_KEY_PEPPER);
  const tenancy = createMemoryTenancyStore(mem.keys);
  const metrics = cfg.FEATURE_METRICS ? createMetrics("aihay-api-test") : null;
  const app = createApp({
    config: cfg,
    registry: loadRegistryFromYaml(),
    logger: createLogger("error"),
    keys: mem.keys,
    usage: mem.usage,
    tenancy,
    rateLimiter: createMemoryRateLimiter(),
    metrics,
  });
  return { app, mem, cfg, metrics };
}

describe("app integration", () => {
  it("health and models", async () => {
    const { app } = testApp();
    const health = await app.request("/health");
    expect(health.status).toBe(200);

    const unauth = await app.request("/v1/models");
    expect(unauth.status).toBe(401);

    const models = await app.request("/v1/models", {
      headers: { Authorization: "Bearer sk-aihay-dev-local" },
    });
    expect(models.status).toBe(200);
    const body = (await models.json()) as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("exposes prometheus metrics when enabled", async () => {
    const { app } = testApp({ metrics: true });
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("aihay_http_requests_total");
    expect(text).toContain("aihay_usage_enqueue_failures_total");
  });

  it("returns 404 for metrics when disabled", async () => {
    const { app } = testApp({ metrics: false });
    const res = await app.request("/metrics");
    expect(res.status).toBe(404);
  });

  it("rejects tools and records request_complete metrics", async () => {
    const { app, mem, metrics } = testApp({ metrics: true });
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer sk-aihay-dev-local",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        tools: [{ type: "function" }],
      }),
    });
    expect(res.status).toBe(400);
    // validation fails before usage ledger write
    expect(mem.usageEvents.length).toBe(0);
    const text = await metrics!.registry.metrics();
    expect(text).toMatch(/aihay_http_requests_total\{.*status="400"/);
  });

  it("emits metrics after failed chat (missing provider key)", async () => {
    const { app, metrics } = testApp({ metrics: true });
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer sk-aihay-dev-local",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(res.status).toBe(502);
    const text = await metrics!.registry.metrics();
    expect(text).toMatch(/aihay_http_requests_total\{.*status="502"/);
  });

  it("rejects vision content arrays", async () => {
    const { app } = testApp();
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer sk-aihay-dev-local",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "hi" }],
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unsupported_parameter");
  });

  it("accepts created memory key", async () => {
    const { app, mem, cfg } = testApp();
    const created = await mem.keys.createKey({ name: "t" });
    const models = await app.request("/v1/models", {
      headers: { Authorization: `Bearer ${created.secret}` },
    });
    expect(models.status).toBe(200);
    expect(cfg.AIHAY_DEV_KEY).toBeTruthy();
  });
});
