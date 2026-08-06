import type { Logger } from "../lib/logger.js";
import type { Metrics } from "./metrics.js";

/** Architecture V2 / Impl Plan V2.0 — one log line per terminal chat request (no prompts). */
export interface RequestCompleteEvent {
  request_id: string;
  workspace_id: string;
  api_key_id: string;
  route: string;
  stream: boolean;
  model_requested: string;
  model_used: string;
  provider: string;
  status: "success" | "error" | "aborted";
  http_status: number;
  latency_ms: number;
  ttft_ms: number | null;
  attempt_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd_estimate: number;
  credential_mode: "platform" | "byok";
  error_code: string | null;
}

export function logRequestComplete(
  logger: Logger,
  enabled: boolean,
  event: RequestCompleteEvent,
): void {
  if (!enabled) return;
  logger.info("request_complete", { ...event });
}

export function recordRequestCompleteMetrics(
  metrics: Metrics | null,
  event: RequestCompleteEvent,
): void {
  if (!metrics) return;
  metrics.httpRequestsTotal.inc({
    route: event.route,
    status: String(event.http_status),
  });
  metrics.requestDurationMs.observe({ route: event.route }, event.latency_ms);
  if (event.ttft_ms != null) {
    metrics.ttftMs.observe({ provider: event.provider }, event.ttft_ms);
  }
  if (event.prompt_tokens > 0) {
    metrics.tokensTotal.inc(
      { direction: "prompt", provider: event.provider },
      event.prompt_tokens,
    );
  }
  if (event.completion_tokens > 0) {
    metrics.tokensTotal.inc(
      { direction: "completion", provider: event.provider },
      event.completion_tokens,
    );
  }
  if (event.cost_usd_estimate > 0) {
    metrics.costUsdTotal.inc(event.cost_usd_estimate);
  }
}
