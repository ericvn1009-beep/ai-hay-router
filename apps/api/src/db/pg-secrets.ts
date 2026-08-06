import { randomUUID } from "node:crypto";
import type pg from "pg";
import {
  decryptSecret,
  encryptSecret,
  secretHint,
  type ByokProvider,
} from "../crypto/byok.js";
import type { ProviderSecretMeta, ProviderSecretStore } from "./secret-types.js";

function mapMeta(row: Record<string, unknown>): ProviderSecretMeta {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    provider: row.provider as ByokProvider,
    keyHint: row.key_hint as string,
    updatedByUserId: (row.updated_by_user_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function createPgSecretStore(
  pool: pg.Pool,
  masterKey: Buffer,
): ProviderSecretStore {
  return {
    async list(workspaceId) {
      const res = await pool.query(
        `SELECT id, workspace_id, provider, key_hint, updated_by_user_id, created_at, updated_at
         FROM provider_secrets WHERE workspace_id = $1 ORDER BY provider`,
        [workspaceId],
      );
      return res.rows.map(mapMeta);
    },

    async getMeta(workspaceId, provider) {
      const res = await pool.query(
        `SELECT id, workspace_id, provider, key_hint, updated_by_user_id, created_at, updated_at
         FROM provider_secrets WHERE workspace_id = $1 AND provider = $2`,
        [workspaceId, provider],
      );
      if (!res.rows[0]) return null;
      return mapMeta(res.rows[0]);
    },

    async getDecrypted(workspaceId, provider) {
      const res = await pool.query(
        `SELECT ciphertext, iv, auth_tag FROM provider_secrets
         WHERE workspace_id = $1 AND provider = $2`,
        [workspaceId, provider],
      );
      const row = res.rows[0];
      if (!row) return null;
      return decryptSecret(
        {
          ciphertext: Buffer.from(row.ciphertext),
          iv: Buffer.from(row.iv),
          authTag: Buffer.from(row.auth_tag),
        },
        masterKey,
      );
    },

    async upsert(workspaceId, provider, apiKey, updatedByUserId = null) {
      const blob = encryptSecret(apiKey, masterKey);
      const hint = secretHint(apiKey);
      const id = randomUUID();
      const res = await pool.query(
        `INSERT INTO provider_secrets (
          id, workspace_id, provider, ciphertext, iv, auth_tag, key_hint, updated_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (workspace_id, provider) DO UPDATE SET
          ciphertext = EXCLUDED.ciphertext,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          key_hint = EXCLUDED.key_hint,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = now()
        RETURNING id, workspace_id, provider, key_hint, updated_by_user_id, created_at, updated_at`,
        [
          id,
          workspaceId,
          provider,
          blob.ciphertext,
          blob.iv,
          blob.authTag,
          hint,
          updatedByUserId,
        ],
      );
      return mapMeta(res.rows[0]);
    },

    async delete(workspaceId, provider) {
      const res = await pool.query(
        `DELETE FROM provider_secrets WHERE workspace_id = $1 AND provider = $2`,
        [workspaceId, provider],
      );
      return (res.rowCount ?? 0) > 0;
    },
  };
}
