"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  created_at: string;
};

function KeysInner() {
  const { workspace, setError } = useWorkspace();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("default");
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.listKeys(workspace.id);
    setKeys(res.data);
  }, [workspace.id]);

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof ApiError ? e.message : "Failed to load keys"),
    );
  }, [refresh, setError]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSecret(null);
    try {
      const created = await api.createKey(workspace.id, name || "default");
      setSecret(created.secret);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this key? Apps using it will fail immediately.")) return;
    setError(null);
    try {
      await api.revokeKey(workspace.id, id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Revoke failed");
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>API keys</h1>
        <p className="muted">
          Workspace <span className="mono">{workspace.name}</span> · role{" "}
          <span className="mono">{workspace.role}</span>
        </p>
      </div>

      {secret && (
        <div className="card stack">
          <strong className="ok">Copy this secret now — it will not be shown again.</strong>
          <div className="secret-box mono">{secret}</div>
          <button type="button" className="secondary" onClick={() => setSecret(null)}>
            Dismiss
          </button>
        </div>
      )}

      <form className="card row" onSubmit={onCreate}>
        <label style={{ flex: 1, minWidth: 160 }}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={loading} style={{ alignSelf: "flex-end" }}>
          {loading ? "Creating…" : "Create key"}
        </button>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="mono">{k.prefix}…</td>
                <td>{k.revoked ? <span className="error">revoked</span> : <span className="ok">active</span>}</td>
                <td>
                  {!k.revoked && (
                    <button type="button" className="danger" onClick={() => void onRevoke(k.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Use keys with the data plane:{" "}
        <code className="mono">Authorization: Bearer sk-aihay-…</code> on{" "}
        <code className="mono">POST /v1/chat/completions</code>.
      </p>
    </div>
  );
}

export default function KeysPage() {
  return (
    <AuthGate>
      <KeysInner />
    </AuthGate>
  );
}
