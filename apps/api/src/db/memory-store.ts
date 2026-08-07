import { randomUUID } from "node:crypto";
import { generateApiKeySecret, hashApiKey } from "../lib/hash.js";
import type {
  ApiKeyRecord,
  CreateKeyInput,
  CreateKeyResult,
  KeyStore,
  UsageEventInput,
  UsageStore,
  Workspace,
} from "./types.js";

export function createMemoryStores(pepper: string): {
  keys: KeyStore;
  usage: UsageStore;
  usageEvents: UsageEventInput[];
} {
  const workspaces = new Map<string, Workspace>();
  const keys = new Map<string, ApiKeyRecord>();
  const usageEvents: UsageEventInput[] = [];

  let defaultOrgId = randomUUID();
  let defaultWorkspaceId = randomUUID();

  function seedDefault() {
    if (workspaces.has(defaultWorkspaceId)) return;
    workspaces.set(defaultWorkspaceId, {
      id: defaultWorkspaceId,
      organizationId: defaultOrgId,
      name: "default",
      slug: "default",
      createdAt: new Date(),
    });
  }

  const keyStore: KeyStore = {
    async ensureDefaultWorkspace() {
      seedDefault();
      return defaultWorkspaceId;
    },

    async ensureTenancyBootstrap() {
      seedDefault();
      return { organizationId: defaultOrgId, workspaceId: defaultWorkspaceId };
    },

    async createWorkspace(opts) {
      seedDefault();
      const id = randomUUID();
      const organizationId = opts.organizationId ?? defaultOrgId;
      const ws: Workspace = {
        id,
        organizationId,
        name: opts.name,
        slug: opts.slug ?? `ws-${id.replace(/-/g, "").slice(0, 12)}`,
        createdAt: new Date(),
      };
      workspaces.set(id, ws);
      return ws;
    },

    async listWorkspaces(organizationId?: string) {
      seedDefault();
      return [...workspaces.values()]
        .filter((w) => !organizationId || w.organizationId === organizationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async getWorkspace(workspaceId: string) {
      return workspaces.get(workspaceId) ?? null;
    },

    async setWorkspaceSuspended(workspaceId: string, suspended: boolean) {
      const ws = workspaces.get(workspaceId);
      if (!ws) return null;
      const next = { ...ws, suspendedAt: suspended ? new Date() : null };
      workspaces.set(workspaceId, next);
      return next;
    },

    async createKey(input: CreateKeyInput): Promise<CreateKeyResult> {
      seedDefault();
      const workspaceId = input.workspaceId ?? defaultWorkspaceId;
      if (!workspaces.has(workspaceId)) {
        throw new Error(`Unknown workspace: ${workspaceId}`);
      }
      const { secret, prefix } = generateApiKeySecret();
      const record: ApiKeyRecord = {
        id: randomUUID(),
        workspaceId,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hashApiKey(secret, pepper),
        rateLimitRpm: input.rateLimitRpm ?? null,
        dailyTokenLimit: input.dailyTokenLimit ?? null,
        dailyCostUsdLimit: input.dailyCostUsdLimit ?? null,
        createdByUserId: input.createdByUserId ?? null,
        revokedAt: null,
        createdAt: new Date(),
      };
      keys.set(record.keyHash, record);
      return { record, secret };
    },

    async listKeys(opts) {
      return [...keys.values()]
        .filter((k) => !opts?.workspaceId || k.workspaceId === opts.workspaceId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async revokeByPrefix(prefix: string, opts) {
      let found = false;
      for (const [hash, rec] of keys) {
        if (opts?.workspaceId && rec.workspaceId !== opts.workspaceId) continue;
        if (rec.keyPrefix.startsWith(prefix) || prefix.startsWith(rec.keyPrefix)) {
          keys.set(hash, { ...rec, revokedAt: new Date() });
          found = true;
        }
      }
      return found;
    },

    async findByHash(keyHash: string) {
      return keys.get(keyHash) ?? null;
    },
  };

  const usageStore: UsageStore = {
    async insert(event) {
      const ws = workspaces.get(event.workspaceId);
      usageEvents.push({
        ...event,
        organizationId: event.organizationId ?? ws?.organizationId ?? null,
      });
    },

    async listByWorkspace(workspaceId: string, limit = 100) {
      return usageEvents
        .filter((e) => e.workspaceId === workspaceId)
        .slice(-limit)
        .reverse();
    },
  };

  return { keys: keyStore, usage: usageStore, usageEvents };
}
