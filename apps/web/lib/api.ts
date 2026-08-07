/** Browser client — BFF proxies to control plane and admin APIs. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
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

async function control<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(`/api/control${path}`, init);
}

async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(`/api/admin${path}`, init);
}

export type User = {
  id: string;
  email: string;
  name: string | null;
  platform_admin?: boolean;
};
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
      public_api_base_url?: string;
      grafana_url?: string | null;
    }>("/me"),

  listModels: () =>
    control<{
      data: Array<{
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
      }>;
      aliases_enabled: boolean;
    }>("/models"),

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
        token_breakdown?: {
          input: number;
          output: number;
          cachedInput: number;
          reasoning: number;
          total: number;
        } | null;
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

  listProviders: (workspaceId: string) =>
    control<{
      enabled: boolean;
      providers: Array<{
        provider: string;
        configured: boolean;
        key_hint: string | null;
        updated_at?: string | null;
      }>;
    }>(`/workspaces/${workspaceId}/providers`),

  putProviderSecret: (workspaceId: string, provider: string, apiKey: string) =>
    control<{
      provider: string;
      configured: boolean;
      key_hint: string;
    }>(`/workspaces/${workspaceId}/providers/${provider}/secret`, {
      method: "PUT",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  deleteProviderSecret: (workspaceId: string, provider: string) =>
    control<{ ok: boolean; provider: string; configured: boolean }>(
      `/workspaces/${workspaceId}/providers/${provider}/secret`,
      { method: "DELETE" },
    ),

  wallet: (workspaceId: string) =>
    control<{
      enabled: boolean;
      balance_usd: number | null;
      ledger: Array<{
        id: string;
        kind: string;
        amount_usd: number;
        balance_after: number;
        reason: string | null;
        created_at: string;
      }>;
    }>(`/workspaces/${workspaceId}/wallet`),

  creditWallet: (
    workspaceId: string,
    body: { amount_usd: number; idempotency_key: string; reason?: string },
  ) =>
    control<{ balance_usd: number; replayed: boolean; entry_id: string }>(
      `/workspaces/${workspaceId}/wallet/credit`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getBudget: (workspaceId: string) =>
    control<{
      enabled: boolean;
      policy: {
        hard_cost_usd_daily: number | null;
        soft_cost_usd_daily: number | null;
        hard_tokens_daily: number | null;
        soft_tokens_daily: number | null;
      } | null;
      usage: { costUsd: number; tokens: number; day: string } | null;
    }>(`/workspaces/${workspaceId}/budget`),

  putBudget: (
    workspaceId: string,
    body: {
      hard_cost_usd_daily?: number | null;
      soft_cost_usd_daily?: number | null;
      hard_tokens_daily?: number | null;
      soft_tokens_daily?: number | null;
    },
  ) =>
    control<{ policy: Record<string, unknown> }>(
      `/workspaces/${workspaceId}/budget`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  adminHealth: () =>
    adminApi<{
      api: string;
      database: string;
      grafana_url: string | null;
    }>("/health"),

  adminWorkspaces: () =>
    adminApi<{
      data: Array<{
        id: string;
        name: string;
        organization_id: string | null;
        suspended_at: string | null;
      }>;
    }>("/workspaces"),

  adminUsers: () =>
    adminApi<{
      data: Array<{
        id: string;
        email: string;
        platform_admin: boolean;
      }>;
    }>("/users"),

  adminSuspend: (workspaceId: string) =>
    adminApi<{ ok: boolean }>(`/workspaces/${workspaceId}/suspend`, {
      method: "POST",
    }),

  adminUnsuspend: (workspaceId: string) =>
    adminApi<{ ok: boolean }>(`/workspaces/${workspaceId}/unsuspend`, {
      method: "POST",
    }),

  adminUsage: () =>
    adminApi<{ data: Array<Record<string, unknown>> }>("/usage?limit=100"),

  adminAudit: () =>
    adminApi<{ data: Array<Record<string, unknown>> }>("/audit"),
};
