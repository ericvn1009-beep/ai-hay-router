"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

type ProviderRow = {
  provider: string;
  configured: boolean;
  key_hint: string | null;
  updated_at?: string | null;
};

function ByokInner() {
  const { workspace, setError } = useWorkspace();
  const [enabled, setEnabled] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.listProviders(workspace.id);
    setEnabled(res.enabled);
    setProviders(res.providers);
  }, [workspace.id]);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof ApiError ? e.message : "Failed to load providers"),
    );
  }, [refresh, setError]);

  async function onSave(e: FormEvent, provider: string) {
    e.preventDefault();
    const apiKey = drafts[provider]?.trim();
    if (!apiKey) {
      setError("Enter an API key");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.putProviderSecret(workspace.id, provider, apiKey);
      setDrafts((d) => ({ ...d, [provider]: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(provider: string) {
    if (!confirm(`Remove ${provider} key? Traffic falls back to platform keys if configured.`)) {
      return;
    }
    setError(null);
    try {
      await api.deleteProviderSecret(workspace.id, provider);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Bring your own key</h1>
        <p className="muted">
          Workspace <span className="mono">{workspace.name}</span> · secrets are encrypted at rest
          and never shown again after save.
        </p>
      </div>

      {!enabled && (
        <div className="card">
          <p>
            BYOK is disabled on this API (<span className="mono">FEATURE_BYOK=false</span>). Ask
            an operator to enable it.
          </p>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.provider} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong className="mono">{p.provider}</strong>
            <span className="muted">
              {p.configured ? (
                <>
                  configured <span className="mono">{p.key_hint}</span>
                </>
              ) : (
                "not set — uses platform key if available"
              )}
            </span>
          </div>
          {enabled && (
            <form className="row" onSubmit={(e) => void onSave(e, p.provider)}>
              <input
                type="password"
                className="mono"
                placeholder={`${p.provider} API key`}
                value={drafts[p.provider] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.provider]: e.target.value }))
                }
                autoComplete="off"
              />
              <button type="submit" disabled={loading}>
                Save
              </button>
              {p.configured && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void onDelete(p.provider)}
                >
                  Remove
                </button>
              )}
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ByokPage() {
  return (
    <AuthGate>
      <ByokInner />
    </AuthGate>
  );
}
