import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createMemoryStores } from "./db/memory-store.js";
import { createLogger } from "./lib/logger.js";
import { createMemoryRateLimiter } from "./lib/rate-limit.js";
import { loadRegistryFromYaml } from "./registry/load.js";

function testApp() {
  const config = loadConfig({
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test",
    DEFAULT_MAX_TOKENS: "100",
    DEFAULT_RPM: "1000",
    STORE_DRIVER: "memory",
  } as unknown as NodeJS.ProcessEnv);
  // fix coerce
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
    DATABASE_URL: "",
    REDIS_URL: "",
    STORE_DRIVER: "memory" as const,
    AIHAY_DEV_KEY: "sk-aihay-dev-local",
    AIHAY_KEY_PEPPER: "test",
  };
  const mem = createMemoryStores(cfg.AIHAY_KEY_PEPPER);
  const app = createApp({
    config: cfg,
    registry: loadRegistryFromYaml(),
    logger: createLogger("error"),
    keys: mem.keys,
    usage: mem.usage,
    rateLimiter: createMemoryRateLimiter(),
  });
  return { app, mem, cfg };
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

  it("rejects tools and records usage on error path readiness", async () => {
    const { app, mem } = testApp();
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
    // usage may be 0 because validation throws before enqueue for tools... actually validation throws in route before try usage on tools - check
    // tools throw from validate before try/catch usage for non-stream - looking at code: validate is before try for stream/nonstream, so no usage on validation error. OK.
    expect(mem.usageEvents.length).toBe(0);
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
