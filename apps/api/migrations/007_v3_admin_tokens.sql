-- V3.1 platform admin + V3.4 token usage breakdown

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS token_breakdown JSONB NULL;
