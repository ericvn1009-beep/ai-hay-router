import { describe, expect, it, vi } from "vitest";
import type { Logger } from "../../lib/logger.js";
import { createMetrics, resetMetricsForTests } from "../metrics.js";
import {
  logRequestComplete,
  recordRequestCompleteMetrics,
  type RequestCompleteEvent,
} from "../request-complete.js";

function sampleEvent(over: Partial<RequestCompleteEvent> = {}): RequestCompleteEvent {
  return {
    request_id: "r1",
    workspace_id: "w1",
    api_key_id: "k1",
    route: "/v1/chat/completions",
    stream: false,
    model_requested: "openai/gpt-4o-mini",
    model_used: "openai/gpt-4o-mini",
    provider: "openai",
    status: "success",
    http_status: 200,
    latency_ms: 42,
    ttft_ms: null,
    attempt_count: 1,
    prompt_tokens: 10,
    completion_tokens: 5,
    cost_usd_estimate: 0.001,
    credential_mode: "platform",
    error_code: null,
    ...over,
  };
}

describe("request_complete", () => {
  it("logs when enabled and skips when disabled", () => {
    const info = vi.fn();
    const logger = { info } as unknown as Logger;
    logRequestComplete(logger, true, sampleEvent());
    expect(info).toHaveBeenCalledWith(
      "request_complete",
      expect.objectContaining({ request_id: "r1", prompt_tokens: 10 }),
    );
    info.mockClear();
    logRequestComplete(logger, false, sampleEvent());
    expect(info).not.toHaveBeenCalled();
  });

  it("records prometheus metrics without high-cardinality labels", async () => {
    resetMetricsForTests();
    const metrics = createMetrics("test");
    recordRequestCompleteMetrics(metrics, sampleEvent({ ttft_ms: 120 }));
    const text = await metrics.registry.metrics();
    expect(text).toContain("aihay_http_requests_total");
    expect(text).toContain('route="/v1/chat/completions"');
    expect(text).toContain("aihay_tokens_total");
    expect(text).toContain("aihay_ttft_ms");
    expect(text).not.toContain("api_key_id");
  });
});
