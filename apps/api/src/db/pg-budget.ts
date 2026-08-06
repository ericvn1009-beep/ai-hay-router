import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { RateLimiter } from "../lib/rate-limit.js";
import type {
  BudgetCheckResult,
  BudgetPolicy,
  BudgetStore,
  BudgetUsage,
} from "./budget-types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapPolicy(row: pg.QueryResultRow): BudgetPolicy {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    hardCostUsdDaily:
      row.hard_cost_usd_daily != null ? Number(row.hard_cost_usd_daily) : null,
    softCostUsdDaily:
      row.soft_cost_usd_daily != null ? Number(row.soft_cost_usd_daily) : null,
    hardTokensDaily:
      row.hard_tokens_daily != null ? Number(row.hard_tokens_daily) : null,
    softTokensDaily:
      row.soft_tokens_daily != null ? Number(row.soft_tokens_daily) : null,
    updatedAt: row.updated_at,
  };
}

/** Policies in Postgres; daily counters via RateLimiter synthetic key ids. */
export function createPgBudgetStore(
  pool: pg.Pool,
  rateLimiter: RateLimiter,
): BudgetStore {
  return {
    async getPolicy(workspaceId) {
      const res = await pool.query(
        `SELECT * FROM budget_policies WHERE workspace_id = $1`,
        [workspaceId],
      );
      if (!res.rows[0]) return null;
      return mapPolicy(res.rows[0]);
    },

    async upsertPolicy(workspaceId, input) {
      const existing = await this.getPolicy(workspaceId);
      const id = existing?.id ?? randomUUID();
      const hardCost =
        input.hardCostUsdDaily !== undefined
          ? input.hardCostUsdDaily
          : (existing?.hardCostUsdDaily ?? null);
      const softCost =
        input.softCostUsdDaily !== undefined
          ? input.softCostUsdDaily
          : (existing?.softCostUsdDaily ?? null);
      const hardTok =
        input.hardTokensDaily !== undefined
          ? input.hardTokensDaily
          : (existing?.hardTokensDaily ?? null);
      const softTok =
        input.softTokensDaily !== undefined
          ? input.softTokensDaily
          : (existing?.softTokensDaily ?? null);

      const res = await pool.query(
        `INSERT INTO budget_policies (
          id, workspace_id, hard_cost_usd_daily, soft_cost_usd_daily,
          hard_tokens_daily, soft_tokens_daily, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6, now())
        ON CONFLICT (workspace_id) DO UPDATE SET
          hard_cost_usd_daily = EXCLUDED.hard_cost_usd_daily,
          soft_cost_usd_daily = EXCLUDED.soft_cost_usd_daily,
          hard_tokens_daily = EXCLUDED.hard_tokens_daily,
          soft_tokens_daily = EXCLUDED.soft_tokens_daily,
          updated_at = now()
        RETURNING *`,
        [id, workspaceId, hardCost, softCost, hardTok, softTok],
      );
      return mapPolicy(res.rows[0]);
    },

    async getUsage(workspaceId): Promise<BudgetUsage> {
      const costMicro = await rateLimiter.getDailyTokens(`ws-cost:${workspaceId}`);
      const tokens = await rateLimiter.getDailyTokens(`ws-tok:${workspaceId}`);
      return {
        costUsd: costMicro / 1_000_000,
        tokens,
        day: today(),
      };
    },

    async addUsage(workspaceId, costUsd, tokens) {
      const micro = Math.round(costUsd * 1_000_000);
      await rateLimiter.addDailyTokens(`ws-cost:${workspaceId}`, micro);
      await rateLimiter.addDailyTokens(`ws-tok:${workspaceId}`, tokens);
      return this.getUsage(workspaceId);
    },

    async check(workspaceId): Promise<BudgetCheckResult> {
      const policy = await this.getPolicy(workspaceId);
      const u = await this.getUsage(workspaceId);
      if (!policy) {
        return { allowed: true, softWarning: false, usage: u, policy: null };
      }
      if (policy.hardCostUsdDaily != null && u.costUsd >= policy.hardCostUsdDaily) {
        return {
          allowed: false,
          softWarning: false,
          reason: `Hard daily cost budget exceeded (${u.costUsd.toFixed(4)} >= ${policy.hardCostUsdDaily})`,
          usage: u,
          policy,
        };
      }
      if (policy.hardTokensDaily != null && u.tokens >= policy.hardTokensDaily) {
        return {
          allowed: false,
          softWarning: false,
          reason: `Hard daily token budget exceeded (${u.tokens} >= ${policy.hardTokensDaily})`,
          usage: u,
          policy,
        };
      }
      let softWarning = false;
      if (policy.softCostUsdDaily != null && u.costUsd >= policy.softCostUsdDaily) {
        softWarning = true;
      }
      if (policy.softTokensDaily != null && u.tokens >= policy.softTokensDaily) {
        softWarning = true;
      }
      return { allowed: true, softWarning, usage: u, policy };
    },
  };
}
