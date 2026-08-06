import { randomUUID } from "node:crypto";
import type {
  BudgetCheckResult,
  BudgetPolicy,
  BudgetStore,
  BudgetUsage,
} from "./budget-types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createMemoryBudgetStore(): BudgetStore {
  const policies = new Map<string, BudgetPolicy>();
  const usage = new Map<string, BudgetUsage>();

  function usageKey(workspaceId: string) {
    return `${workspaceId}:${today()}`;
  }

  return {
    async getPolicy(workspaceId) {
      return policies.get(workspaceId) ?? null;
    },

    async upsertPolicy(workspaceId, input) {
      const existing = policies.get(workspaceId);
      const policy: BudgetPolicy = {
        id: existing?.id ?? randomUUID(),
        workspaceId,
        hardCostUsdDaily:
          input.hardCostUsdDaily !== undefined
            ? input.hardCostUsdDaily
            : (existing?.hardCostUsdDaily ?? null),
        softCostUsdDaily:
          input.softCostUsdDaily !== undefined
            ? input.softCostUsdDaily
            : (existing?.softCostUsdDaily ?? null),
        hardTokensDaily:
          input.hardTokensDaily !== undefined
            ? input.hardTokensDaily
            : (existing?.hardTokensDaily ?? null),
        softTokensDaily:
          input.softTokensDaily !== undefined
            ? input.softTokensDaily
            : (existing?.softTokensDaily ?? null),
        updatedAt: new Date(),
      };
      policies.set(workspaceId, policy);
      return policy;
    },

    async getUsage(workspaceId) {
      const u = usage.get(usageKey(workspaceId));
      if (!u || u.day !== today()) return { costUsd: 0, tokens: 0, day: today() };
      return u;
    },

    async addUsage(workspaceId, costUsd, tokens) {
      const key = usageKey(workspaceId);
      const cur = await this.getUsage(workspaceId);
      const next = {
        costUsd: cur.costUsd + costUsd,
        tokens: cur.tokens + tokens,
        day: today(),
      };
      usage.set(key, next);
      return next;
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
      if (policy.softCostUsdDaily != null && u.costUsd >= policy.softCostUsdDaily) softWarning = true;
      if (policy.softTokensDaily != null && u.tokens >= policy.softTokensDaily) softWarning = true;
      return { allowed: true, softWarning, usage: u, policy };
    },
  };
}
