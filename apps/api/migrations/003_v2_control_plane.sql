-- V2.2 control plane: invites + audit events

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by_user_id UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (email);
CREATE INDEX IF NOT EXISTS invites_org_idx ON invites (organization_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  workspace_id UUID REFERENCES workspaces(id),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NULL,
  resource_id TEXT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_org_created_idx
  ON audit_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_ws_created_idx
  ON audit_events (workspace_id, created_at DESC);
