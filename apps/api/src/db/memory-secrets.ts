import { randomUUID } from "node:crypto";
import {
  decryptSecret,
  encryptSecret,
  secretHint,
  type ByokProvider,
  type EncryptedBlob,
} from "../crypto/byok.js";
import type { ProviderSecretMeta, ProviderSecretStore } from "./secret-types.js";

interface Row {
  meta: ProviderSecretMeta;
  blob: EncryptedBlob;
}

export function createMemorySecretStore(masterKey: Buffer): ProviderSecretStore {
  const rows = new Map<string, Row>();

  function key(workspaceId: string, provider: ByokProvider) {
    return `${workspaceId}:${provider}`;
  }

  return {
    async list(workspaceId) {
      return [...rows.values()]
        .filter((r) => r.meta.workspaceId === workspaceId)
        .map((r) => r.meta)
        .sort((a, b) => a.provider.localeCompare(b.provider));
    },

    async getMeta(workspaceId, provider) {
      return rows.get(key(workspaceId, provider))?.meta ?? null;
    },

    async getDecrypted(workspaceId, provider) {
      const row = rows.get(key(workspaceId, provider));
      if (!row) return null;
      return decryptSecret(row.blob, masterKey);
    },

    async upsert(workspaceId, provider, apiKey, updatedByUserId = null) {
      const existing = rows.get(key(workspaceId, provider));
      const blob = encryptSecret(apiKey, masterKey);
      const now = new Date();
      const meta: ProviderSecretMeta = {
        id: existing?.meta.id ?? randomUUID(),
        workspaceId,
        provider,
        keyHint: secretHint(apiKey),
        updatedByUserId: updatedByUserId ?? null,
        createdAt: existing?.meta.createdAt ?? now,
        updatedAt: now,
      };
      rows.set(key(workspaceId, provider), { meta, blob });
      return meta;
    },

    async delete(workspaceId, provider) {
      return rows.delete(key(workspaceId, provider));
    },
  };
}
