"use client";

import { useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

function UsageInner() {
  const { workspace, setError } = useWorkspace();
  const [summary, setSummary] = useState<{
    total_requests: number;
    total_tokens: number;
    total_cost_usd_estimate: number;
    by_model: Array<{ model: string; requests: number; tokens: number; cost: number }>;
  } | null>(null);
  const [rows, setRows] = useState<
    Array<{
      request_id: string;
      model_used: string;
      provider: string;
      prompt_tokens: number;
      completion_tokens: number;
      cost_usd_estimate: number;
      status: string;
      latency_ms: number;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, u] = await Promise.all([
          api.usageSummary(workspace.id),
          api.usage(workspace.id),
        ]);
        if (cancelled) return;
        setSummary(s);
        setRows(u.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Failed to load usage");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.id, setError]);

  const maxTokens = Math.max(1, ...(summary?.by_model.map((m) => m.tokens) ?? [1]));

  return (
    <div className="stack">
      <div>
        <h1>Usage</h1>
        <p className="muted">Recent activity for workspace {workspace.name}</p>
      </div>

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted">Requests</div>
          <strong>{summary?.total_requests ?? "—"}</strong>
        </div>
        <div>
          <div className="muted">Tokens</div>
          <strong>{summary?.total_tokens ?? "—"}</strong>
        </div>
        <div>
          <div className="muted">Est. cost (USD)</div>
          <strong>
            {summary ? summary.total_cost_usd_estimate.toFixed(6) : "—"}
          </strong>
        </div>
      </div>

      {summary && summary.by_model.length > 0 && (
        <div className="card">
          <h3>By model</h3>
          {summary.by_model.map((m) => (
            <div className="bar-row" key={m.model}>
              <span className="mono">{m.model}</span>
              <div className="bar">
                <span style={{ width: `${(m.tokens / maxTokens) * 100}%` }} />
              </div>
              <span className="muted">{m.tokens}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Recent requests</h3>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Provider</th>
              <th>Tokens</th>
              <th>Status</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No usage yet — send traffic to the data plane.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.request_id}>
                <td className="mono">{r.model_used}</td>
                <td>{r.provider}</td>
                <td>
                  {r.prompt_tokens}+{r.completion_tokens}
                </td>
                <td>{r.status}</td>
                <td>{r.latency_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UsagePage() {
  return (
    <AuthGate>
      <UsageInner />
    </AuthGate>
  );
}
