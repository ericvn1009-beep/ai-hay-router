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
  const { workspace, publicApiBaseUrl, setError } = useWorkspace();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("default");
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const base = publicApiBaseUrl.replace(/\/$/, "");
  const sampleKey = secret ?? "sk-aihay-YOUR_KEY";

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

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  const curlModels = `curl -s ${base}/models \\
  -H "Authorization: Bearer ${sampleKey}"`;

  const curlChat = `curl -s ${base}/chat/completions \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "anthropic/claude-haiku-4-5",
    "messages": [{"role":"user","content":"hi"}],
    "stream": false
  }'`;

  const sdkSnippet = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}",
  apiKey: process.env.AIHAY_API_KEY ?? "${sampleKey}",
});

const res = await client.chat.completions.create({
  model: "anthropic/claude-haiku-4-5",
  messages: [{ role: "user", content: "hi" }],
});`;

  return (
    <div className="stack">
      <div>
        <h1>API keys</h1>
        <p className="muted">
          Workspace <span className="mono">{workspace.name}</span> · role{" "}
          <span className="mono">{workspace.role}</span>
        </p>
      </div>

      <div className="card stack">
        <h3>How to use your API key</h3>
        <p className="muted">
          Base URL: <span className="mono">{base}</span>{" "}
          <button type="button" className="secondary" onClick={() => copy(base)}>
            Copy
          </button>
        </p>
        <p className="muted">
          Auth header: <span className="mono">Authorization: Bearer sk-aihay-…</span>
        </p>
        <p className="muted">
          Secret is shown <strong>once</strong> at create time. If lost, revoke and create a new
          key. See <a href="/models">Models</a> for available <span className="mono">model</span>{" "}
          ids.
        </p>
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong className="mono">curl · list models</strong>
            <button type="button" className="secondary" onClick={() => copy(curlModels)}>
              Copy
            </button>
          </div>
          <pre className="secret-box mono" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {curlModels}
          </pre>
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong className="mono">curl · chat</strong>
            <button type="button" className="secondary" onClick={() => copy(curlChat)}>
              Copy
            </button>
          </div>
          <pre className="secret-box mono" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {curlChat}
          </pre>
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong className="mono">OpenAI SDK</strong>
            <button type="button" className="secondary" onClick={() => copy(sdkSnippet)}>
              Copy
            </button>
          </div>
          <pre className="secret-box mono" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {sdkSnippet}
          </pre>
        </div>
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
                <td>
                  {k.revoked ? (
                    <span className="error">revoked</span>
                  ) : (
                    <span className="ok">active</span>
                  )}
                </td>
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
