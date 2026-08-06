import client from "prom-client";

export interface Metrics {
  registry: client.Registry;
  httpRequestsTotal: client.Counter<"route" | "status">;
  requestDurationMs: client.Histogram<"route">;
  upstreamAttemptsTotal: client.Counter<"provider" | "result">;
  ttftMs: client.Histogram<"provider">;
  tokensTotal: client.Counter<"direction" | "provider">;
  costUsdTotal: client.Counter<string>;
  usageEnqueueFailuresTotal: client.Counter<string>;
}

let singleton: Metrics | null = null;

export function createMetrics(serviceName = "aihay_api"): Metrics {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: serviceName });
  client.collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new client.Counter({
    name: "aihay_http_requests_total",
    help: "HTTP requests completed (chat and other instrumented routes)",
    labelNames: ["route", "status"] as const,
    registers: [registry],
  });

  const requestDurationMs = new client.Histogram({
    name: "aihay_request_duration_ms",
    help: "End-to-end request duration in milliseconds",
    labelNames: ["route"] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
    registers: [registry],
  });

  const upstreamAttemptsTotal = new client.Counter({
    name: "aihay_upstream_attempts_total",
    help: "Upstream provider attempts",
    labelNames: ["provider", "result"] as const,
    registers: [registry],
  });

  const ttftMs = new client.Histogram({
    name: "aihay_ttft_ms",
    help: "Time to first token for streaming responses (ms)",
    labelNames: ["provider"] as const,
    buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000],
    registers: [registry],
  });

  const tokensTotal = new client.Counter({
    name: "aihay_tokens_total",
    help: "Tokens processed",
    labelNames: ["direction", "provider"] as const,
    registers: [registry],
  });

  const costUsdTotal = new client.Counter({
    name: "aihay_cost_usd_total",
    help: "Estimated cost in USD (sum of per-request estimates)",
    registers: [registry],
  });

  const usageEnqueueFailuresTotal = new client.Counter({
    name: "aihay_usage_enqueue_failures_total",
    help: "Failed usage ledger inserts",
    registers: [registry],
  });

  return {
    registry,
    httpRequestsTotal,
    requestDurationMs,
    upstreamAttemptsTotal,
    ttftMs,
    tokensTotal,
    costUsdTotal,
    usageEnqueueFailuresTotal,
  };
}

/** Process-wide metrics when FEATURE_METRICS is on. */
export function getOrCreateMetrics(enabled: boolean, serviceName?: string): Metrics | null {
  if (!enabled) return null;
  if (!singleton) singleton = createMetrics(serviceName);
  return singleton;
}

/** Test helper: reset singleton. */
export function resetMetricsForTests(): void {
  singleton = null;
}

export async function renderMetrics(metrics: Metrics): Promise<string> {
  return metrics.registry.metrics();
}
