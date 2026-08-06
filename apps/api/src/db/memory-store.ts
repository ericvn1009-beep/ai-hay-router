import { randomUUID } from "node:crypto";
import { generateApiKeySecret, hashApiKey } from "../lib/hash.js";
import type {
  ApiKeyRecord,
  CreateKeyInput,
  CreateKeyResult,
  KeyStore,
  UsageEventInput,
  UsageStore,
} from "./types.js";

export function createMemoryStores(pepper: string): {
  keys: KeyStore;
  usage: UsageStore;
  usageEvents: UsageEventInput[];
} {
  let workspaceId = randomUUID();
  const keys = new Map<string, ApiKeyRecord>();
  const usageEvents: UsageEventInput[] = [];

  const keyStore: KeyStore = {
    async ensureDefaultWorkspace() {
      return workspaceId;
    },

    async createKey(input: CreateKeyInput): Promise<CreateKeyResult> {
      await this.ensureDefaultWorkspace();
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
        revokedAt: null,
        createdAt: new Date(),
      };
      keys.set(record.keyHash, record);
      return { record, secret };
    },

    async listKeys() {
      return [...keys.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    },

    async revokeByPrefix(prefix: string) {
      let found = false;
      for (const [hash, rec] of keys) {
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
      usageEvents.push(event);
    },
  };

  return { keys: keyStore, usage: usageStore, usageEvents };
}
