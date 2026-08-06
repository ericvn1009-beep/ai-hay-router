import { describe, expect, it } from "vitest";
import { loadRegistryFromYaml } from "../load.js";
import { resolveAlias } from "../aliases.js";
import { resolveModel } from "../resolve.js";

describe("aliases", () => {
  const registry = loadRegistryFromYaml();

  it("resolves default aliases", () => {
    expect(resolveAlias("aihay/cheap").resolved).toBe("openai/gpt-4o-mini");
    expect(resolveAlias("aihay/balanced").isAlias).toBe(true);
  });

  it("resolveModel expands aliases when enabled", () => {
    const m = resolveModel(registry, "aihay/cheap", { aliasesEnabled: true });
    expect(m.id).toBe("openai/gpt-4o-mini");
    expect(m.aliasRequested).toBe("aihay/cheap");
  });

  it("resolveModel rejects aliases when disabled", () => {
    expect(() =>
      resolveModel(registry, "aihay/cheap", { aliasesEnabled: false }),
    ).toThrow(/aliases are disabled/i);
  });

  it("rejects aihay/auto always", () => {
    expect(() =>
      resolveModel(registry, "aihay/auto", { aliasesEnabled: true }),
    ).toThrow(/V3/);
  });
});
