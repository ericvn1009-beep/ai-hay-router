export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  organizationId: string | null;
  name: string;
  slug: string | null;
  createdAt: Date;
  suspendedAt?: Date | null;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  platformAdmin?: boolean;
}

/** Normalized multi-type token usage (V3.4). */
export interface TokenBreakdown {
  input: number;
  output: number;
  cachedInput: number;
  reasoning: number;
  image: number;
  audio: number;
  tool: number;
  total: number;
}

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitRpm: number | null;
  dailyTokenLimit: number | null;
  dailyCostUsdLimit: number | null;
  createdByUserId: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateKeyInput {
  name: string;
  /** Target workspace; default workspace if omitted */
  workspaceId?: string;
  createdByUserId?: string | null;
  rateLimitRpm?: number | null;
  dailyTokenLimit?: number | null;
  dailyCostUsdLimit?: number | null;
}

export interface CreateKeyResult {
  record: ApiKeyRecord;
  /** Full secret — only available at creation */
  secret: string;
}

export interface UsageEventInput {
  requestId: string;
  apiKeyId: string;
  workspaceId: string;
  organizationId?: string | null;
  modelRequested: string;
  modelUsed: string;
  provider: string;
  endpointId: string | null;
  promptTokens: number;
  completionTokens: number;
  costUsdEstimate: number;
  usageEstimated: boolean;
  latencyMs: number;
  ttftMs: number | null;
  status: "success" | "error" | "aborted";
  errorCode: string | null;
  attemptCount: number;
  /** platform | byok — set when known (V2.5+) */
  credentialMode?: "platform" | "byok" | null;
  tokenBreakdown?: TokenBreakdown | null;
}

export interface KeyStore {
  /** Ensure default org + workspace exist; return default workspace id */
  ensureDefaultWorkspace(): Promise<string>;
  /** Full tenancy bootstrap (default org/workspace) */
  ensureTenancyBootstrap(): Promise<{ organizationId: string; workspaceId: string }>;
  createWorkspace(opts: {
    name: string;
    organizationId?: string;
    slug?: string;
  }): Promise<Workspace>;
  listWorkspaces(organizationId?: string): Promise<Workspace[]>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  /** Soft-suspend data plane for workspace keys (platform admin). */
  setWorkspaceSuspended?(
    workspaceId: string,
    suspended: boolean,
  ): Promise<Workspace | null>;
  createKey(input: CreateKeyInput): Promise<CreateKeyResult>;
  listKeys(opts?: { workspaceId?: string }): Promise<ApiKeyRecord[]>;
  revokeByPrefix(prefix: string, opts?: { workspaceId?: string }): Promise<boolean>;
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
}

export interface UsageStore {
  insert(event: UsageEventInput): Promise<void>;
  /** Workspace-scoped list for isolation tests / control plane prep */
  listByWorkspace(workspaceId: string, limit?: number): Promise<UsageEventInput[]>;
}
