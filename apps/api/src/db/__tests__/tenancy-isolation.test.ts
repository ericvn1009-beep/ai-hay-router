import { describe, expect, it } from "vitest";
import { createMemoryStores } from "../memory-store.js";

describe("tenancy isolation (memory)", () => {
  it("keys and usage are isolated by workspace", async () => {
    const pepper = "iso-test";
    const { keys, usage } = createMemoryStores(pepper);
    await keys.ensureTenancyBootstrap();

    const wsA = await keys.createWorkspace({ name: "team-a" });
    const wsB = await keys.createWorkspace({ name: "team-b" });

    const keyA = await keys.createKey({ name: "a", workspaceId: wsA.id });
    const keyB = await keys.createKey({ name: "b", workspaceId: wsB.id });

    const listA = await keys.listKeys({ workspaceId: wsA.id });
    const listB = await keys.listKeys({ workspaceId: wsB.id });
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(keyA.record.id);
    expect(listB).toHaveLength(1);
    expect(listB[0].id).toBe(keyB.record.id);
    expect(listA[0].workspaceId).not.toBe(listB[0].workspaceId);

    await usage.insert({
      requestId: "ra",
      apiKeyId: keyA.record.id,
      workspaceId: wsA.id,
      modelRequested: "openai/gpt-4o-mini",
      modelUsed: "openai/gpt-4o-mini",
      provider: "openai",
      endpointId: null,
      promptTokens: 1,
      completionTokens: 1,
      costUsdEstimate: 0,
      usageEstimated: false,
      latencyMs: 1,
      ttftMs: null,
      status: "success",
      errorCode: null,
      attemptCount: 1,
    });
    await usage.insert({
      requestId: "rb",
      apiKeyId: keyB.record.id,
      workspaceId: wsB.id,
      modelRequested: "xai/grok-3-mini",
      modelUsed: "xai/grok-3-mini",
      provider: "xai",
      endpointId: null,
      promptTokens: 2,
      completionTokens: 2,
      costUsdEstimate: 0,
      usageEstimated: false,
      latencyMs: 2,
      ttftMs: null,
      status: "success",
      errorCode: null,
      attemptCount: 1,
    });

    const usageA = await usage.listByWorkspace(wsA.id);
    const usageB = await usage.listByWorkspace(wsB.id);
    expect(usageA).toHaveLength(1);
    expect(usageA[0].requestId).toBe("ra");
    expect(usageB).toHaveLength(1);
    expect(usageB[0].requestId).toBe("rb");

    // Revoke scoped to workspace A must not revoke B
    const revoked = await keys.revokeByPrefix(keyA.record.keyPrefix, {
      workspaceId: wsA.id,
    });
    expect(revoked).toBe(true);
    const afterA = await keys.findByHash(keyA.record.keyHash);
    const afterB = await keys.findByHash(keyB.record.keyHash);
    expect(afterA?.revokedAt).toBeTruthy();
    expect(afterB?.revokedAt).toBeNull();
  });

  it("bootstrap creates default org linkage", async () => {
    const { keys } = createMemoryStores("boot");
    const tenancy = await keys.ensureTenancyBootstrap();
    expect(tenancy.workspaceId).toBeTruthy();
    expect(tenancy.organizationId).toBeTruthy();
    const ws = await keys.getWorkspace(tenancy.workspaceId);
    expect(ws?.organizationId).toBe(tenancy.organizationId);
  });
});
