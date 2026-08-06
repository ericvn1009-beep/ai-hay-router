/** Browser client — calls Next BFF which proxies to the control plane. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function control<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/control${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = data as { error?: { message?: string; code?: string } };
    throw new ApiError(
      res.status,
      err.error?.message ?? res.statusText,
      err.error?.code,
    );
  }
  return data as T;
}

export type User = { id: string; email: string; name: string | null };
export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  organization_id: string | null;
  role: string;
};

export const api = {
  register: (body: { email: string; password: string; name?: string }) =>
    control<{ user: User; workspace_id: string; organization_id: string }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) },
    ),

  login: (body: { email: string; password: string }) =>
    control<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () => control<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () =>
    control<{
      user: User;
      workspaces: Workspace[];
    }>("/me"),

  listKeys: (workspaceId: string) =>
    control<{
      data: Array<{
        id: string;
        name: string;
        prefix: string;
        revoked: boolean;
        created_at: string;
      }>;
    }>(`/workspaces/${workspaceId}/keys`),

  createKey: (workspaceId: string, name: string) =>
    control<{
      id: string;
      name: string;
      prefix: string;
      secret: string;
    }>(`/workspaces/${workspaceId}/keys`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeKey: (workspaceId: string, keyId: string) =>
    control<{ ok: boolean }>(`/workspaces/${workspaceId}/keys/${keyId}`, {
      method: "DELETE",
    }),

  usage: (workspaceId: string) =>
    control<{
      data: Array<{
        request_id: string;
        model_used: string;
        provider: string;
        prompt_tokens: number;
        completion_tokens: number;
        cost_usd_estimate: number;
        status: string;
        latency_ms: number;
      }>;
    }>(`/workspaces/${workspaceId}/usage?limit=50`),

  usageSummary: (workspaceId: string) =>
    control<{
      total_requests: number;
      total_tokens: number;
      total_cost_usd_estimate: number;
      by_model: Array<{
        model: string;
        requests: number;
        tokens: number;
        cost: number;
      }>;
    }>(`/workspaces/${workspaceId}/usage/summary`),
};
