import { describe, expect, it } from "vitest";
import { loadConfig } from "../../config.js";
import { resolveMasterKey } from "../../crypto/byok.js";
import { createMemorySecretStore } from "../../db/memory-secrets.js";
import { resolveCredential } from "../resolve-credential.js";

function cfg(extra: Record<string, string> = {}) {
  return loadConfig({
    AIHAY_KEY_PEPPER: "pepper",
    OPENAI_API_KEY: "platform-openai",
    ANTHROPIC_API_KEY: "",
    XAI_API_KEY: "",
    FEATURE_BYOK: "true",
    ...extra,
  } as unknown as NodeJS.ProcessEnv);
}

describe("resolveCredential", () => {
  it("prefers BYOK over platform", async () => {
    const master = resolveMasterKey({ masterKey: "m", pepper: "p" });
    const secrets = createMemorySecretStore(master);
    await secrets.upsert("ws1", "openai", "byok-openai");

    const r = await resolveCredential({
      credentialRef: "OPENAI_API_KEY",
      workspaceId: "ws1",
      config: cfg(),
      secrets,
    });
    expect(r?.mode).toBe("byok");
    expect(r?.apiKey).toBe("byok-openai");
  });

  it("falls back to platform when no BYOK", async () => {
    const master = resolveMasterKey({ masterKey: "m", pepper: "p" });
    const secrets = createMemorySecretStore(master);

    const r = await resolveCredential({
      credentialRef: "OPENAI_API_KEY",
      workspaceId: "ws1",
      config: cfg(),
      secrets,
    });
    expect(r?.mode).toBe("platform");
    expect(r?.apiKey).toBe("platform-openai");
  });

  it("skips BYOK when feature disabled", async () => {
    const master = resolveMasterKey({ masterKey: "m", pepper: "p" });
    const secrets = createMemorySecretStore(master);
    await secrets.upsert("ws1", "openai", "byok-openai");

    const r = await resolveCredential({
      credentialRef: "OPENAI_API_KEY",
      workspaceId: "ws1",
      config: cfg({ FEATURE_BYOK: "false" }),
      secrets,
    });
    expect(r?.mode).toBe("platform");
    expect(r?.apiKey).toBe("platform-openai");
  });

  it("returns null when neither BYOK nor platform", async () => {
    const r = await resolveCredential({
      credentialRef: "ANTHROPIC_API_KEY",
      workspaceId: "ws1",
      config: cfg({ FEATURE_BYOK: "true" }),
      secrets: createMemorySecretStore(resolveMasterKey({ masterKey: "m", pepper: "p" })),
    });
    expect(r).toBeNull();
  });
});
