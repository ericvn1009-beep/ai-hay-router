import { describe, expect, it } from "vitest";
import { createMemoryWalletStore } from "../memory-wallet.js";

describe("wallet store", () => {
  it("credits are idempotent", async () => {
    const w = createMemoryWalletStore();
    const a = await w.credit("ws", 10, { idempotencyKey: "topup-1" });
    const b = await w.credit("ws", 10, { idempotencyKey: "topup-1" });
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(true);
    expect((await w.getBalance("ws")).balanceUsd).toBe(10);
  });

  it("debits are idempotent on request_id", async () => {
    const w = createMemoryWalletStore();
    await w.credit("ws", 5, { idempotencyKey: "c1" });
    const d1 = await w.debit("ws", 1.5, { requestId: "req-1" });
    const d2 = await w.debit("ws", 1.5, { requestId: "req-1" });
    expect(d1.allowed).toBe(true);
    expect(d2.replayed).toBe(true);
    expect((await w.getBalance("ws")).balanceUsd).toBeCloseTo(3.5);
  });

  it("blocks debit when insufficient", async () => {
    const w = createMemoryWalletStore();
    await w.credit("ws", 1, { idempotencyKey: "c" });
    const d = await w.debit("ws", 2, { requestId: "r" });
    expect(d.allowed).toBe(false);
    expect((await w.getBalance("ws")).balanceUsd).toBe(1);
  });

  it("canSpend fails at zero balance", async () => {
    const w = createMemoryWalletStore();
    const check = await w.canSpend("ws");
    expect(check.allowed).toBe(false);
  });
});
