import type { ByokProvider } from "../crypto/byok.js";

export type CredentialMode = "platform" | "byok";

export interface ProviderSecretMeta {
  id: string;
  workspaceId: string;
  provider: ByokProvider;
  /** Non-sensitive display hint (e.g. …abcd) */
  keyHint: string;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderSecretStore {
  /** List configured providers for a workspace (no secret material). */
  list(workspaceId: string): Promise<ProviderSecretMeta[]>;
  getMeta(workspaceId: string, provider: ByokProvider): Promise<ProviderSecretMeta | null>;
  /**
   * Decrypt and return the API key for data-plane use only.
   * Callers must not log or persist the result.
   */
  getDecrypted(workspaceId: string, provider: ByokProvider): Promise<string | null>;
  upsert(
    workspaceId: string,
    provider: ByokProvider,
    apiKey: string,
    updatedByUserId?: string | null,
  ): Promise<ProviderSecretMeta>;
  delete(workspaceId: string, provider: ByokProvider): Promise<boolean>;
}
