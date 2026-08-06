import type { ModelRecord } from "../registry/types.js";

export interface Attempt {
  n: number;
  logicalModel: string;
  provider: string;
  upstreamModel: string;
  endpointId: string;
  baseUrl: string;
  credentialRef: string;
}

/**
 * Build ordered attempts: for each model in chain, try each endpoint by priority.
 */
export function buildAttemptPlan(
  primary: ModelRecord,
  resolveFallback: (id: string) => ModelRecord | undefined,
  requestFallbacks: string[] | undefined,
  maxAttempts: number,
): Attempt[] {
  const modelChain: ModelRecord[] = [primary];
  const seen = new Set<string>([primary.id]);

  const extras = [
    ...(requestFallbacks ?? []),
    ...(primary.fallback_models ?? []),
  ];
  for (const id of extras) {
    if (seen.has(id)) continue;
    const rec = resolveFallback(id);
    if (!rec) continue;
    seen.add(id);
    modelChain.push(rec);
  }

  const attempts: Attempt[] = [];
  let n = 0;
  for (const model of modelChain) {
    const endpoints = [...model.endpoints].sort((a, b) => a.priority - b.priority);
    for (const ep of endpoints) {
      n += 1;
      attempts.push({
        n,
        logicalModel: model.id,
        provider: model.provider,
        upstreamModel: model.upstream_id,
        endpointId: ep.id,
        baseUrl: ep.base_url,
        credentialRef: ep.credential_ref,
      });
      if (attempts.length >= maxAttempts) return attempts;
    }
  }
  return attempts;
}
