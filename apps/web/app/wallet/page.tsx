"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

type LedgerRow = {
  id: string;
  kind: string;
  amount_usd: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
};

function WalletInner() {
  const { workspace, setError } = useWorkspace();
  const [enabled, setEnabled] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.wallet(workspace.id);
    setEnabled(res.enabled);
    setBalance(res.balance_usd);
    setLedger(res.ledger ?? []);
  }, [workspace.id]);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof ApiError ? e.message : "Failed to load wallet"),
    );
  }, [refresh, setError]);

  async function onCredit(e: FormEvent) {
    e.preventDefault();
    const usd = Number(amount);
    if (!Number.isFinite(usd) || usd <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.creditWallet(workspace.id, {
        amount_usd: usd,
        idempotency_key: `ui-${Date.now()}`,
        reason: "dashboard_topup",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Credit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Wallet</h1>
        <p className="muted">
          Prepaid credits for platform-path inference. BYOK traffic can bypass billing when
          configured.
        </p>
      </div>

      {!enabled ? (
        <div className="card">
          <p>
            Credits are disabled (<span className="mono">FEATURE_CREDITS=false</span>).
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="muted">Balance</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 600 }}>
              ${balance?.toFixed(4) ?? "0.0000"}
            </div>
          </div>

          <form className="card row" onSubmit={(e) => void onCredit(e)}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount USD"
            />
            <button type="submit" disabled={loading}>
              Add credits
            </button>
          </form>

          <div className="card stack">
            <strong>Ledger</strong>
            {ledger.length === 0 && <p className="muted">No entries yet.</p>}
            {ledger.map((row) => (
              <div key={row.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="mono">
                  {row.kind} ${row.amount_usd.toFixed(4)}
                </span>
                <span className="muted">
                  bal ${row.balance_after.toFixed(4)} · {row.reason ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WalletPage() {
  return (
    <AuthGate>
      <WalletInner />
    </AuthGate>
  );
}
