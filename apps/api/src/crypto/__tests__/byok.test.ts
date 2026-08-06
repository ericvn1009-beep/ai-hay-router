import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  providerFromCredentialRef,
  resolveMasterKey,
  secretHint,
} from "../byok.js";

describe("byok crypto", () => {
  it("round-trips secrets with AES-GCM", () => {
    const key = resolveMasterKey({ masterKey: "test-master-key-for-unit", pepper: "p" });
    const secret = "sk-openai-super-secret-value";
    const blob = encryptSecret(secret, key);
    expect(blob.iv.length).toBe(12);
    expect(blob.authTag.length).toBe(16);
    expect(decryptSecret(blob, key)).toBe(secret);
  });

  it("rejects tampered ciphertext", () => {
    const key = resolveMasterKey({ masterKey: "k", pepper: "p" });
    const blob = encryptSecret("hello", key);
    blob.ciphertext[0] ^= 0xff;
    expect(() => decryptSecret(blob, key)).toThrow();
  });

  it("maps credential refs and hints", () => {
    expect(providerFromCredentialRef("OPENAI_API_KEY")).toBe("openai");
    expect(providerFromCredentialRef("ANTHROPIC_API_KEY")).toBe("anthropic");
    expect(providerFromCredentialRef("XAI_API_KEY")).toBe("xai");
    expect(providerFromCredentialRef("OTHER")).toBeNull();
    expect(secretHint("sk-abc1234567")).toBe("…4567");
  });

  it("accepts hex master keys", () => {
    const hex = "ab".repeat(32);
    const key = resolveMasterKey({ masterKey: hex, pepper: "x" });
    expect(key.length).toBe(32);
  });
});
