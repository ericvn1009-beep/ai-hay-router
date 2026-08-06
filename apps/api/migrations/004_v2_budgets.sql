-- V2.4 workspace budget policies

CREATE TABLE IF NOT EXISTS budget_policies (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  hard_cost_usd_daily NUMERIC NULL,
  soft_cost_usd_daily NUMERIC NULL,
  hard_tokens_daily BIGINT NULL,
  soft_tokens_daily BIGINT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_policies_workspace_idx ON budget_policies (workspace_id);
