import { describe, expect, it } from "vitest";
import { createMemoryBudgetStore } from "../memory-budget.js";

describe("budget store", () => {
  it("allows when no policy", async () => {
    const b = createMemoryBudgetStore();
    const check = await b.check("ws-1");
    expect(check.allowed).toBe(true);
  });

  it("enforces hard token budget", async () => {
    const b = createMemoryBudgetStore();
    await b.upsertPolicy("ws-1", { hardTokensDaily: 100 });
    await b.addUsage("ws-1", 0, 100);
    const check = await b.check("ws-1");
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/token/i);
  });

  it("enforces hard cost budget", async () => {
    const b = createMemoryBudgetStore();
    await b.upsertPolicy("ws-1", { hardCostUsdDaily: 1 });
    await b.addUsage("ws-1", 1.5, 0);
    const check = await b.check("ws-1");
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/cost/i);
  });

  it("soft budget warns but allows", async () => {
    const b = createMemoryBudgetStore();
    await b.upsertPolicy("ws-1", { softTokensDaily: 10, hardTokensDaily: 1000 });
    await b.addUsage("ws-1", 0, 50);
    const check = await b.check("ws-1");
    expect(check.allowed).toBe(true);
    expect(check.softWarning).toBe(true);
  });
});
