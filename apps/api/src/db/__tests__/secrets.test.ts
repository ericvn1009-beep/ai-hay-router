import { describe, expect, it } from "vitest";
import { resolveMasterKey } from "../../crypto/byok.js";
import { createMemorySecretStore } from "../memory-secrets.js";

describe("provider secret store", () => {
  const master = resolveMasterKey({ masterKey: "unit-test-master", pepper: "p" });

  it("isolates secrets across workspaces", async () => {
    const store = createMemorySecretStore(master);
    await store.upsert("ws-a", "openai", "key-a");
    await store.upsert("ws-b", "openai", "key-b");

    expect(await store.getDecrypted("ws-a", "openai")).toBe("key-a");
    expect(await store.getDecrypted("ws-b", "openai")).toBe("key-b");
    expect(await store.getDecrypted("ws-c", "openai")).toBeNull();

    const listA = await store.list("ws-a");
    expect(listA).toHaveLength(1);
    expect(listA[0]?.keyHint).toMatch(/…/);
    // Meta never includes raw key
    expect(JSON.stringify(listA[0])).not.toContain("key-a");
  });

  it("upsert replaces and delete removes", async () => {
    const store = createMemorySecretStore(master);
    await store.upsert("ws", "anthropic", "first");
    await store.upsert("ws", "anthropic", "second");
    expect(await store.getDecrypted("ws", "anthropic")).toBe("second");
    expect(await store.delete("ws", "anthropic")).toBe(true);
    expect(await store.getDecrypted("ws", "anthropic")).toBeNull();
  });
});
