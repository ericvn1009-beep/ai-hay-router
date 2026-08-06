-- V2.1 tenancy foundation: orgs, users, memberships; scope workspaces + usage

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NULL,
  password_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_org_idx ON memberships (organization_id);

-- Evolve workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug TEXT;

-- Evolve api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);

-- Evolve usage_events
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS usage_events_org_created_idx
  ON usage_events (organization_id, created_at DESC);

-- Bootstrap: ensure every workspace has an organization
DO $$
DECLARE
  r RECORD;
  org_id UUID;
  org_slug TEXT;
BEGIN
  FOR r IN SELECT id, name FROM workspaces WHERE organization_id IS NULL
  LOOP
    org_id := gen_random_uuid();
    org_slug := 'org-' || replace(r.id::text, '-', '');
    INSERT INTO organizations (id, name, slug)
    VALUES (org_id, coalesce(nullif(r.name, ''), 'default') || ' org', org_slug)
    ON CONFLICT (slug) DO NOTHING;
    -- if slug conflict, pick existing by slug
    SELECT id INTO org_id FROM organizations WHERE slug = org_slug;
    UPDATE workspaces
    SET organization_id = org_id,
        slug = coalesce(slug, 'ws-' || replace(r.id::text, '-', ''))
    WHERE id = r.id;
  END LOOP;
END $$;

-- Backfill usage organization_id from workspace
UPDATE usage_events u
SET organization_id = w.organization_id
FROM workspaces w
WHERE u.workspace_id = w.id
  AND u.organization_id IS NULL
  AND w.organization_id IS NOT NULL;

-- Default org+workspace if no workspaces exist is handled by app ensureTenancyBootstrap
