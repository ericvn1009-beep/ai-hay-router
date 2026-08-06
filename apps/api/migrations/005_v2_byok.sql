-- V2.5 BYOK: encrypted workspace provider secrets + usage credential_mode

CREATE TABLE IF NOT EXISTS provider_secrets (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'xai')),
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_hint TEXT NOT NULL DEFAULT '',
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS provider_secrets_workspace_idx
  ON provider_secrets (workspace_id);

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS credential_mode TEXT
  CHECK (credential_mode IS NULL OR credential_mode IN ('platform', 'byok'));
