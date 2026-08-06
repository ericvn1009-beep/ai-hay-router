"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User, type Workspace } from "@/lib/api";
import { Nav } from "./Nav";

type Ctx = {
  user: User;
  workspace: Workspace;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me.user);
        setWorkspaces(me.workspaces);
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

  return (
    <div className="container">
      <Nav email={user.email} />
      {error && <div className="error">{error}</div>}
      {!workspace ? (
        <div className="card">
          <p>No workspace found for this account.</p>
        </div>
      ) : (
        <WorkspaceContext.Provider value={{ user, workspace, setError }}>
          {children}
        </WorkspaceContext.Provider>
      )}
    </div>
  );
}
