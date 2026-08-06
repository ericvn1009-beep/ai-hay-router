export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitRpm: number | null;
  dailyTokenLimit: number | null;
  dailyCostUsdLimit: number | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateKeyInput {
  name: string;
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
}

export interface KeyStore {
  ensureDefaultWorkspace(): Promise<string>;
  createKey(input: CreateKeyInput): Promise<CreateKeyResult>;
  listKeys(): Promise<ApiKeyRecord[]>;
  revokeByPrefix(prefix: string): Promise<boolean>;
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
}

export interface UsageStore {
  insert(event: UsageEventInput): Promise<void>;
}
