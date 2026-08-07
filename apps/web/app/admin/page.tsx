"use client";

import { useEffect, useState } from "react";
import { AuthGate, useWorkspace } from "@/components/AuthGate";
import { ApiError, api } from "@/lib/api";

function AdminInner() {
  const { platformAdmin, grafanaUrl, setError } = useWorkspace();
  const [health, setHealth] = useState<{
    api: string;
    database: string;
    grafana_url: string | null;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string; suspended_at: string | null }>
  >([]);
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; platform_admin: boolean }>
  >([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!platformAdmin) return;
    (async () => {
      try {
        const [h, w, u, a] = await Promise.all([
          api.adminHealth(),
          api.adminWorkspaces(),
          api.adminUsers(),
          api.adminAudit(),
        ]);
        setHealth(h);
        setWorkspaces(w.data);
        setUsers(u.data);
        setAudit(a.data.slice(0, 20));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Admin load failed");
      }
    })();
  }, [platformAdmin, setError]);

  if (!platformAdmin) {
    return (
      <div className="card">
        <p>Platform admin required.</p>
      </div>
    );
  }

  async function toggleSuspend(id: string, suspended: boolean) {
    try {
      if (suspended) await api.adminUnsuspend(id);
      else await api.adminSuspend(id);
      const w = await api.adminWorkspaces();
      setWorkspaces(w.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Platform admin</h1>
        <p className="muted">System-wide tenants, health, and audit.</p>
      </div>

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted">API</div>
          <strong className={health?.api === "ok" ? "ok" : "error"}>
            {health?.api ?? "…"}
          </strong>
        </div>
        <div>
          <div className="muted">Database</div>
          <strong className={health?.database === "ok" ? "ok" : "error"}>
            {health?.database ?? "…"}
          </strong>
        </div>
        <div>
          {(health?.grafana_url || grafanaUrl) && (
            <a
              href={health?.grafana_url || grafanaUrl || "#"}
              target="_blank"
              rel="noreferrer"
            >
              Open Grafana →
            </a>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Workspaces</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td className="mono">{w.id.slice(0, 8)}…</td>
                <td>{w.suspended_at ? "suspended" : "active"}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void toggleSuspend(w.id, Boolean(w.suspended_at))}
                  >
                    {w.suspended_at ? "Unsuspend" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Users</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.email}</td>
                <td>{u.platform_admin ? "yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Recent audit</h3>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Resource</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a, i) => (
              <tr key={String(a.id ?? i)}>
                <td className="mono">{String(a.action ?? "")}</td>
                <td className="muted">
                  {String(a.resourceType ?? "")} {String(a.resourceId ?? "").slice(0, 12)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGate>
      <AdminInner />
    </AuthGate>
  );
}
