"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

function BudgetInner() {
  const { workspace, setError } = useWorkspace();
  const [enabled, setEnabled] = useState(true);
  const [hardCost, setHardCost] = useState("");
  const [softCost, setSoftCost] = useState("");
  const [hardTok, setHardTok] = useState("");
  const [softTok, setSoftTok] = useState("");
  const [usage, setUsage] = useState<{ costUsd: number; tokens: number; day: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.getBudget(workspace.id);
    setEnabled(res.enabled);
    if (res.policy) {
      setHardCost(
        res.policy.hard_cost_usd_daily != null ? String(res.policy.hard_cost_usd_daily) : "",
      );
      setSoftCost(
        res.policy.soft_cost_usd_daily != null ? String(res.policy.soft_cost_usd_daily) : "",
      );
      setHardTok(
        res.policy.hard_tokens_daily != null ? String(res.policy.hard_tokens_daily) : "",
      );
      setSoftTok(
        res.policy.soft_tokens_daily != null ? String(res.policy.soft_tokens_daily) : "",
      );
    }
    setUsage(res.usage);
  }, [workspace.id]);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof ApiError ? e.message : "Failed to load budget"),
    );
  }, [refresh, setError]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.putBudget(workspace.id, {
        hard_cost_usd_daily: hardCost === "" ? null : Number(hardCost),
        soft_cost_usd_daily: softCost === "" ? null : Number(softCost),
        hard_tokens_daily: hardTok === "" ? null : Number(hardTok),
        soft_tokens_daily: softTok === "" ? null : Number(softTok),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="card">
        <p>
          Budgets disabled (<span className="mono">FEATURE_BUDGETS=false</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1>Budget</h1>
        <p className="muted">Daily soft/hard limits for this workspace.</p>
      </div>
      {usage && (
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="muted">Today ({usage.day})</div>
            <strong>${usage.costUsd.toFixed(4)}</strong> · {usage.tokens} tokens
          </div>
        </div>
      )}
      <form className="card stack" onSubmit={(e) => void onSave(e)}>
        <div className="row">
          <label>
            Hard cost USD/day
            <input value={hardCost} onChange={(e) => setHardCost(e.target.value)} placeholder="none" />
          </label>
          <label>
            Soft cost USD/day
            <input value={softCost} onChange={(e) => setSoftCost(e.target.value)} placeholder="none" />
          </label>
        </div>
        <div className="row">
          <label>
            Hard tokens/day
            <input value={hardTok} onChange={(e) => setHardTok(e.target.value)} placeholder="none" />
          </label>
          <label>
            Soft tokens/day
            <input value={softTok} onChange={(e) => setSoftTok(e.target.value)} placeholder="none" />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save policy"}
        </button>
      </form>
    </div>
  );
}

export default function BudgetPage() {
  return (
    <AuthGate>
      <BudgetInner />
    </AuthGate>
  );
}
