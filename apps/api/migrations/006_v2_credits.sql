-- V2.6 prepaid wallets + append-only ledger

CREATE TABLE IF NOT EXISTS wallets (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  balance_usd NUMERIC NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit')),
  amount_usd NUMERIC NOT NULL CHECK (amount_usd >= 0),
  balance_after NUMERIC NOT NULL,
  request_id TEXT NULL,
  idempotency_key TEXT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent debit per request; idempotent credit per external key
CREATE UNIQUE INDEX IF NOT EXISTS ledger_debit_request_uidx
  ON ledger_entries (workspace_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_credit_idem_uidx
  ON ledger_entries (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ledger_workspace_created_idx
  ON ledger_entries (workspace_id, created_at DESC);
