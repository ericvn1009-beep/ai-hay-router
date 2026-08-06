/**
 * OpenTelemetry stub (FEATURE_OTEL).
 * V2.0: no-op hooks so call sites can be wired without a hard dependency on exporters.
 * Full OTEL SDK can replace this module later.
 */

export interface SpanHandle {
  end(attrs?: Record<string, string | number | boolean>): void;
  recordError(err: unknown): void;
}

export interface OtelHooks {
  enabled: boolean;
  startAttemptSpan(name: string, attrs?: Record<string, string>): SpanHandle;
}

const noopSpan: SpanHandle = {
  end() {},
  recordError() {},
};

export function createOtelHooks(enabled: boolean): OtelHooks {
  if (!enabled) {
    return {
      enabled: false,
      startAttemptSpan: () => noopSpan,
    };
  }
  // Stub: real spans would use @opentelemetry/api
  return {
    enabled: true,
    startAttemptSpan(name, attrs) {
      const start = Date.now();
      return {
        end(endAttrs) {
          if (process.env.OTEL_DEBUG === "1") {
            // eslint-disable-next-line no-console
            console.debug(
              JSON.stringify({
                msg: "otel_span_stub",
                name,
                ms: Date.now() - start,
                ...attrs,
                ...endAttrs,
              }),
            );
          }
        },
        recordError() {},
      };
    },
  };
}
