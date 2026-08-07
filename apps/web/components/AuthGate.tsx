"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User, type Workspace } from "@/lib/api";
import { Nav } from "./Nav";

type Ctx = {
  user: User;
  workspace: Workspace;
  publicApiBaseUrl: string;
  platformAdmin: boolean;
  grafanaUrl: string | null;
  setError: (e: string | null) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside AuthGate");
  return ctx;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [publicApiBaseUrl, setPublicApiBaseUrl] = useState("http://localhost:3000/v1");
  const [grafanaUrl, setGrafanaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me.user);
        setWorkspaces(me.workspaces);
        if (me.public_api_base_url) setPublicApiBaseUrl(me.public_api_base_url);
        setGrafanaUrl(me.grafana_url ?? null);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const workspace = workspaces[0] ?? null;
  const platformAdmin = Boolean(user.platform_admin);

  return (
    <div className="container">
      <Nav email={user.email} platformAdmin={platformAdmin} />
      {error && <div className="error">{error}</div>}
      {!workspace ? (
        <div className="card">
          <p>No workspace found for this account.</p>
        </div>
      ) : (
        <WorkspaceContext.Provider
          value={{
            user,
            workspace,
            publicApiBaseUrl,
            platformAdmin,
            grafanaUrl,
            setError,
          }}
        >
          {children}
        </WorkspaceContext.Provider>
      )}
    </div>
  );
}
