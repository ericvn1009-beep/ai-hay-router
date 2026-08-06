-- AI Hay Router V1 schema

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  rate_limit_rpm INT NULL,
  daily_token_limit BIGINT NULL,
  daily_cost_usd_limit NUMERIC NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON api_keys (workspace_id);

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY,
  request_id TEXT NOT NULL,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  model_requested TEXT NOT NULL,
  model_used TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint_id TEXT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  cost_usd_estimate NUMERIC NOT NULL DEFAULT 0,
  usage_estimated BOOLEAN NOT NULL DEFAULT false,
  latency_ms INT NOT NULL DEFAULT 0,
  ttft_ms INT NULL,
  status TEXT NOT NULL,
  error_code TEXT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_workspace_created_idx
  ON usage_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_key_created_idx
  ON usage_events (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_request_id_idx
  ON usage_events (request_id);
