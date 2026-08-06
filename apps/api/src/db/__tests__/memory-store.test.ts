import { describe, expect, it } from "vitest";
import { hashApiKey } from "../../lib/hash.js";
import { createMemoryStores } from "../memory-store.js";

describe("memory key store", () => {
  it("creates, finds, revokes keys", async () => {
    const pepper = "test-pepper";
    const { keys, usage, usageEvents } = createMemoryStores(pepper);
    const created = await keys.createKey({ name: "dev" });
    expect(created.secret.startsWith("sk-aihay-")).toBe(true);
    expect(created.record.workspaceId).toBeTruthy();
    expect(created.record.createdByUserId).toBeNull();

    const found = await keys.findByHash(hashApiKey(created.secret, pepper));
    expect(found?.id).toBe(created.record.id);

    await usage.insert({
      requestId: "r1",
      apiKeyId: created.record.id,
      workspaceId: created.record.workspaceId,
      modelRequested: "openai/gpt-4o-mini",
      modelUsed: "openai/gpt-4o-mini",
      provider: "openai",
      endpointId: "openai-primary",
      promptTokens: 1,
      completionTokens: 2,
      costUsdEstimate: 0,
      usageEstimated: false,
      latencyMs: 10,
      ttftMs: null,
      status: "success",
      errorCode: null,
      attemptCount: 1,
    });
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0].organizationId).toBeTruthy();

    const revoked = await keys.revokeByPrefix(created.record.keyPrefix);
    expect(revoked).toBe(true);
    const after = await keys.findByHash(hashApiKey(created.secret, pepper));
    expect(after?.revokedAt).toBeTruthy();
  });
});
