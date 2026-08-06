import type { AppConfig } from "../config.js";
import {
  providerFromCredentialRef,
  type ByokProvider,
} from "../crypto/byok.js";
import type { ProviderSecretStore } from "../db/secret-types.js";
import type { CredentialMode } from "../db/secret-types.js";

export interface ResolvedCredential {
  apiKey: string;
  mode: CredentialMode;
  provider: ByokProvider | null;
}

/**
 * Credential resolution order (Architecture V2 §6.3):
 *   BYOK (if FEATURE_BYOK + workspace secret) → platform env → fail
 */
export async function resolveCredential(opts: {
  credentialRef: string;
  workspaceId: string;
  config: AppConfig;
  secrets: ProviderSecretStore | null;
}): Promise<ResolvedCredential | null> {
  const provider = providerFromCredentialRef(opts.credentialRef);

  if (
    opts.config.FEATURE_BYOK &&
    opts.secrets &&
    provider &&
    opts.workspaceId &&
    opts.workspaceId !== "dev-workspace"
  ) {
    const byok = await opts.secrets.getDecrypted(opts.workspaceId, provider);
    if (byok) {
      return { apiKey: byok, mode: "byok", provider };
    }
  }

  const platform = platformKey(opts.credentialRef, opts.config);
  if (platform) {
    return { apiKey: platform, mode: "platform", provider };
  }

  return null;
}

function platformKey(ref: string, config: AppConfig): string {
  if (ref === "OPENAI_API_KEY") return config.OPENAI_API_KEY;
  if (ref === "ANTHROPIC_API_KEY") return config.ANTHROPIC_API_KEY;
  if (ref === "XAI_API_KEY") return config.XAI_API_KEY;
  return process.env[ref] ?? "";
}
