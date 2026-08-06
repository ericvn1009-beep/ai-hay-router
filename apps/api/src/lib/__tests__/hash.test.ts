import { describe, expect, it } from "vitest";
import { generateApiKeySecret, hashApiKey, looksLikeAihayKey, safeEqualHex } from "../hash.js";

describe("hash", () => {
  it("generates sk-aihay keys", () => {
    const { secret, prefix } = generateApiKeySecret();
    expect(looksLikeAihayKey(secret)).toBe(true);
    expect(secret.startsWith(prefix)).toBe(true);
  });

  it("hashes deterministically with pepper", () => {
    const a = hashApiKey("sk-aihay-test", "pepper");
    const b = hashApiKey("sk-aihay-test", "pepper");
    const c = hashApiKey("sk-aihay-test", "other");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(safeEqualHex(a, b)).toBe(true);
  });
});
