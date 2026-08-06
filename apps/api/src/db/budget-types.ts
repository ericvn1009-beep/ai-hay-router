export interface BudgetPolicy {
  id: string;
  workspaceId: string;
  hardCostUsdDaily: number | null;
  softCostUsdDaily: number | null;
  hardTokensDaily: number | null;
  softTokensDaily: number | null;
  updatedAt: Date;
}

export interface BudgetUsage {
  costUsd: number;
  tokens: number;
  day: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  softWarning: boolean;
  reason?: string;
  usage: BudgetUsage;
  policy: BudgetPolicy | null;
}

export interface BudgetStore {
  getPolicy(workspaceId: string): Promise<BudgetPolicy | null>;
  upsertPolicy(
    workspaceId: string,
    input: {
      hardCostUsdDaily?: number | null;
      softCostUsdDaily?: number | null;
      hardTokensDaily?: number | null;
      softTokensDaily?: number | null;
    },
  ): Promise<BudgetPolicy>;
  getUsage(workspaceId: string): Promise<BudgetUsage>;
  addUsage(workspaceId: string, costUsd: number, tokens: number): Promise<BudgetUsage>;
  check(workspaceId: string): Promise<BudgetCheckResult>;
}
