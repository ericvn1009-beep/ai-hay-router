export interface WalletBalance {
  workspaceId: string;
  balanceUsd: number;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  workspaceId: string;
  kind: "credit" | "debit";
  amountUsd: number;
  balanceAfter: number;
  requestId: string | null;
  idempotencyKey: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface CreditResult {
  entry: LedgerEntry;
  /** True when an existing row was returned (idempotent replay). */
  replayed: boolean;
}

export interface DebitResult {
  entry: LedgerEntry | null;
  /** True when debit was skipped because of zero amount or replay. */
  replayed: boolean;
  allowed: boolean;
  reason?: string;
}

export interface WalletStore {
  getBalance(workspaceId: string): Promise<WalletBalance>;
  /** Ensure wallet row exists (balance 0). */
  ensureWallet(workspaceId: string): Promise<WalletBalance>;
  credit(
    workspaceId: string,
    amountUsd: number,
    opts: { idempotencyKey: string; reason?: string },
  ): Promise<CreditResult>;
  /**
   * Debit actual cost. Idempotent on requestId.
   * Returns allowed=false if balance insufficient (no partial debit).
   */
  debit(
    workspaceId: string,
    amountUsd: number,
    opts: { requestId: string; reason?: string },
  ): Promise<DebitResult>;
  /** Soft pre-check: balance must be > 0 (or >= minUsd if set). */
  canSpend(workspaceId: string, minUsd?: number): Promise<{
    allowed: boolean;
    balanceUsd: number;
    reason?: string;
  }>;
  listLedger(workspaceId: string, limit?: number): Promise<LedgerEntry[]>;
}
