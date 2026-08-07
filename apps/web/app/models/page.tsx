"use client";

import { useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

type ModelRow = {
  id: string;
  provider: string;
  virtual: boolean;
  resolves_to: string | null;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_streaming: boolean;
  context_length?: number;
  input_price_per_mtok?: number;
  output_price_per_mtok?: number;
};

function ModelsInner() {
  const { setError } = useWorkspace();
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [aliasesEnabled, setAliasesEnabled] = useState(true);

  useEffect(() => {
    api
      .listModels()
      .then((res) => {
        setRows(res.data);
        setAliasesEnabled(res.aliases_enabled);
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Failed to load models"),
      );
  }, [setError]);

  return (
    <div className="stack">
      <div>
        <h1>Models</h1>
        <p className="muted">
          Catalog available to data-plane API keys (same as{" "}
          <span className="mono">GET /v1/models</span>
          {aliasesEnabled ? "; aliases enabled" : "; aliases disabled"}). Use these ids in{" "}
          <span className="mono">model:</span> — see{" "}
          <a href="/keys">Keys</a> for auth examples.
        </p>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Model id</th>
              <th>Provider</th>
              <th>Type</th>
              <th>Tools</th>
              <th>Vision</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.id}</td>
                <td>{m.provider}</td>
                <td>
                  {m.virtual ? (
                    <span className="muted">
                      alias → <span className="mono">{m.resolves_to}</span>
                    </span>
                  ) : (
                    "canonical"
                  )}
                </td>
                <td>{m.supports_tools ? "yes" : "—"}</td>
                <td>{m.supports_vision ? "yes" : "—"}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void navigator.clipboard.writeText(m.id)}
                  >
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  return (
    <AuthGate>
      <ModelsInner />
    </AuthGate>
  );
}
