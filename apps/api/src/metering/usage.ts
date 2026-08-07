import type { Logger } from "../lib/logger.js";
import type { UsageEventInput, UsageStore } from "../db/types.js";
import type { Metrics } from "../observability/metrics.js";
import { estimateCostUsd } from "./cost.js";
import type { ModelRecord } from "../registry/types.js";

export function buildUsageEvent(opts: {
  requestId: string;
  apiKeyId: string;
  workspaceId: string;
  modelRequested: string;
  modelUsed: string;
  provider: string;
  endpointId: string | null;
  promptTokens: number;
  completionTokens: number;
  usageEstimated: boolean;
  latencyMs: number;
  ttftMs: number | null;
  status: "success" | "error" | "aborted";
  errorCode: string | null;
  attemptCount: number;
  modelRecord?: ModelRecord;
  credentialMode?: "platform" | "byok" | null;
  tokenBreakdown?: import("../db/types.js").TokenBreakdown | null;
}): UsageEventInput {
  return {
    requestId: opts.requestId,
    apiKeyId: opts.apiKeyId,
    workspaceId: opts.workspaceId,
    modelRequested: opts.modelRequested,
    modelUsed: opts.modelUsed,
    provider: opts.provider,
    endpointId: opts.endpointId,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    costUsdEstimate: estimateCostUsd({
      model: opts.modelRecord,
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
    }),
    usageEstimated: opts.usageEstimated,
    latencyMs: opts.latencyMs,
    ttftMs: opts.ttftMs,
    status: opts.status,
    errorCode: opts.errorCode,
    attemptCount: opts.attemptCount,
    credentialMode: opts.credentialMode ?? null,
    tokenBreakdown: opts.tokenBreakdown ?? null,
  };
}

/** Fire-and-forget usage write; never throws to caller. */
export function enqueueUsage(
  store: UsageStore,
  event: UsageEventInput,
  logger: Logger,
  metrics?: Metrics | null,
): void {
  void store.insert(event).catch((e) => {
    metrics?.usageEnqueueFailuresTotal.inc();
    logger.error("usage_insert_failed", {
      request_id: event.requestId,
      message: e instanceof Error ? e.message : String(e),
    });
  });
}
