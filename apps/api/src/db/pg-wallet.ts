import { randomUUID } from "node:crypto";
import type pg from "pg";
import type {
  CreditResult,
  DebitResult,
  LedgerEntry,
  WalletBalance,
  WalletStore,
} from "./wallet-types.js";

function mapLedger(row: Record<string, unknown>): LedgerEntry {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    kind: row.kind as "credit" | "debit",
    amountUsd: Number(row.amount_usd),
    balanceAfter: Number(row.balance_after),
    requestId: (row.request_id as string | null) ?? null,
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapWallet(row: Record<string, unknown>): WalletBalance {
  return {
    workspaceId: row.workspace_id as string,
    balanceUsd: Number(row.balance_usd),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function createPgWalletStore(pool: pg.Pool): WalletStore {
  return {
    async ensureWallet(workspaceId) {
      const res = await pool.query(
        `INSERT INTO wallets (workspace_id, balance_usd)
         VALUES ($1, 0)
         ON CONFLICT (workspace_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id
         RETURNING workspace_id, balance_usd, updated_at`,
        [workspaceId],
      );
      return mapWallet(res.rows[0]);
    },

    async getBalance(workspaceId) {
      const res = await pool.query(
        `SELECT workspace_id, balance_usd, updated_at FROM wallets WHERE workspace_id = $1`,
        [workspaceId],
      );
      if (res.rows[0]) return mapWallet(res.rows[0]);
      return this.ensureWallet(workspaceId);
    },

    async credit(workspaceId, amountUsd, opts): Promise<CreditResult> {
      if (amountUsd < 0) throw new Error("credit amount must be non-negative");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(
          `SELECT * FROM ledger_entries
           WHERE workspace_id = $1 AND idempotency_key = $2`,
          [workspaceId, opts.idempotencyKey],
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return { entry: mapLedger(existing.rows[0]), replayed: true };
        }
        await client.query(
          `INSERT INTO wallets (workspace_id, balance_usd)
           VALUES ($1, 0) ON CONFLICT (workspace_id) DO NOTHING`,
          [workspaceId],
        );
        const upd = await client.query(
          `UPDATE wallets SET balance_usd = balance_usd + $2, updated_at = now()
           WHERE workspace_id = $1
           RETURNING workspace_id, balance_usd, updated_at`,
          [workspaceId, amountUsd],
        );
        const balanceAfter = Number(upd.rows[0].balance_usd);
        const id = randomUUID();
        const ins = await client.query(
          `INSERT INTO ledger_entries (
            id, workspace_id, kind, amount_usd, balance_after,
            request_id, idempotency_key, reason
          ) VALUES ($1,$2,'credit',$3,$4,NULL,$5,$6)
          RETURNING *`,
          [id, workspaceId, amountUsd, balanceAfter, opts.idempotencyKey, opts.reason ?? null],
        );
        await client.query("COMMIT");
        return { entry: mapLedger(ins.rows[0]), replayed: false };
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    async debit(workspaceId, amountUsd, opts): Promise<DebitResult> {
      if (amountUsd < 0) throw new Error("debit amount must be non-negative");
      if (amountUsd === 0) {
        return { entry: null, replayed: false, allowed: true };
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(
          `SELECT * FROM ledger_entries
           WHERE workspace_id = $1 AND request_id = $2`,
          [workspaceId, opts.requestId],
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return { entry: mapLedger(existing.rows[0]), replayed: true, allowed: true };
        }
        await client.query(
          `INSERT INTO wallets (workspace_id, balance_usd)
           VALUES ($1, 0) ON CONFLICT (workspace_id) DO NOTHING`,
          [workspaceId],
        );
        const locked = await client.query(
          `SELECT balance_usd FROM wallets WHERE workspace_id = $1 FOR UPDATE`,
          [workspaceId],
        );
        const bal = Number(locked.rows[0]?.balance_usd ?? 0);
        if (bal < amountUsd) {
          await client.query("ROLLBACK");
          return {
            entry: null,
            replayed: false,
            allowed: false,
            reason: `Insufficient credits (${bal.toFixed(6)} < ${amountUsd.toFixed(6)})`,
          };
        }
        const upd = await client.query(
          `UPDATE wallets SET balance_usd = balance_usd - $2, updated_at = now()
           WHERE workspace_id = $1
           RETURNING balance_usd`,
          [workspaceId, amountUsd],
        );
        const balanceAfter = Number(upd.rows[0].balance_usd);
        const id = randomUUID();
        const ins = await client.query(
          `INSERT INTO ledger_entries (
            id, workspace_id, kind, amount_usd, balance_after,
            request_id, idempotency_key, reason
          ) VALUES ($1,$2,'debit',$3,$4,$5,NULL,$6)
          RETURNING *`,
          [id, workspaceId, amountUsd, balanceAfter, opts.requestId, opts.reason ?? null],
        );
        await client.query("COMMIT");
        return { entry: mapLedger(ins.rows[0]), replayed: false, allowed: true };
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    async canSpend(workspaceId, minUsd = 0) {
      const w = await this.getBalance(workspaceId);
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
      const res = await pool.query(
        `SELECT * FROM ledger_entries
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [workspaceId, limit],
      );
      return res.rows.map(mapLedger);
    },
  };
}
