import { randomUUID } from "node:crypto";
import type {
  DebitResult,
  LedgerEntry,
  WalletBalance,
  WalletStore,
} from "./wallet-types.js";

export function createMemoryWalletStore(): WalletStore {
  const balances = new Map<string, WalletBalance>();
  const ledger: LedgerEntry[] = [];
  const debitByRequest = new Map<string, LedgerEntry>();
  const creditByIdem = new Map<string, LedgerEntry>();

  function walletKey(ws: string) {
    return ws;
  }

  function debitKey(ws: string, requestId: string) {
    return `${ws}:${requestId}`;
  }

  function creditKey(ws: string, idem: string) {
    return `${ws}:${idem}`;
  }

  async function ensure(workspaceId: string): Promise<WalletBalance> {
    let w = balances.get(walletKey(workspaceId));
    if (!w) {
      w = { workspaceId, balanceUsd: 0, updatedAt: new Date() };
      balances.set(walletKey(workspaceId), w);
    }
    return w;
  }

  return {
    async getBalance(workspaceId) {
      return ensure(workspaceId);
    },

    async ensureWallet(workspaceId) {
      return ensure(workspaceId);
    },

    async credit(workspaceId, amountUsd, opts) {
      if (amountUsd < 0) throw new Error("credit amount must be non-negative");
      const existing = creditByIdem.get(creditKey(workspaceId, opts.idempotencyKey));
      if (existing) {
        return { entry: existing, replayed: true };
      }
      const w = await ensure(workspaceId);
      const next = w.balanceUsd + amountUsd;
      w.balanceUsd = next;
      w.updatedAt = new Date();
      const entry: LedgerEntry = {
        id: randomUUID(),
        workspaceId,
        kind: "credit",
        amountUsd,
        balanceAfter: next,
        requestId: null,
        idempotencyKey: opts.idempotencyKey,
        reason: opts.reason ?? null,
        createdAt: new Date(),
      };
      ledger.push(entry);
      creditByIdem.set(creditKey(workspaceId, opts.idempotencyKey), entry);
      return { entry, replayed: false };
    },

    async debit(workspaceId, amountUsd, opts): Promise<DebitResult> {
      if (amountUsd < 0) throw new Error("debit amount must be non-negative");
      const existing = debitByRequest.get(debitKey(workspaceId, opts.requestId));
      if (existing) {
        return { entry: existing, replayed: true, allowed: true };
      }
      if (amountUsd === 0) {
        return { entry: null, replayed: false, allowed: true };
      }
      const w = await ensure(workspaceId);
      if (w.balanceUsd < amountUsd) {
        return {
          entry: null,
          replayed: false,
          allowed: false,
          reason: `Insufficient credits (${w.balanceUsd.toFixed(6)} < ${amountUsd.toFixed(6)})`,
        };
      }
      const next = w.balanceUsd - amountUsd;
      w.balanceUsd = next;
      w.updatedAt = new Date();
      const entry: LedgerEntry = {
        id: randomUUID(),
        workspaceId,
        kind: "debit",
        amountUsd,
        balanceAfter: next,
        requestId: opts.requestId,
        idempotencyKey: null,
        reason: opts.reason ?? null,
        createdAt: new Date(),
      };
      ledger.push(entry);
      debitByRequest.set(debitKey(workspaceId, opts.requestId), entry);
      return { entry, replayed: false, allowed: true };
    },

    async canSpend(workspaceId, minUsd = 0) {
      const w = await ensure(workspaceId);
      const threshold = minUsd > 0 ? minUsd : Number.EPSILON;
      if (w.balanceUsd < threshold || w.balanceUsd <= 0) {
        return {
          allowed: false,
          balanceUsd: w.balanceUsd,
          reason: "Insufficient credits",
        };
      }
      return { allowed: true, balanceUsd: w.balanceUsd };
    },

    async listLedger(workspaceId, limit = 50) {
      return ledger
        .filter((e) => e.workspaceId === workspaceId)
        .slice()
        .reverse()
        .slice(0, limit);
    },
  };
}
