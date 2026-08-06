# AI Hay Router — Scalability Design

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Scalability architecture |
| **Status** | Draft |
| **Last updated** | 2026-08-06 |
| **Companions** | [Architecture V1](./architecture-v1.md) · [Architecture V2](./architecture-v2.md) · [Implementation Plan V2](./implementation-plan-v2.md) · [Runbook](../runbook.md) |
| **Baseline** | TypeScript · Hono · Postgres · Redis · stream-through data plane |

How AI Hay scales from a single Compose stack toward **regional production**, **multi-region edge**, and (if ever required) **hyperscale gateway** throughput—without violating V1 stream-through and metering laws.

---

## 1. Scope and definitions

### 1.1 What we are scaling

AI Hay is an **I/O-bound LLM gateway**: auth, validate, route, stream tokens, meter. It does **not** run foundation-model inference.

| Workload | Dominated by |
| --- | --- |
| Gateway CPU/memory | Auth, JSON, SSE piping, concurrent streams |
| End-to-end latency | **Upstream model TTFT + generation** |
| Cost at scale | **Provider bills**, not Node pods |

### 1.2 RPS vs concurrent streams

Do not optimize only for “requests per second.”

| Metric | Meaning for chat |
| --- | --- |
| **Arrival RPS** | New `POST /v1/chat/completions` starts |
| **Concurrent streams** | Open SSE connections ≈ RPS × average duration |
| **Upstream tokens/sec** | Real inference throughput (provider-limited) |

Example: **1,000 RPS** × **30 s** average stream ⇒ **~30,000 concurrent** streams. Multi-million RPS of *full* LLM completions implies tens of millions of concurrent streams and hyperscaler-scale spend—treat that as a **different problem class** than multi-million **edge HTTP hits** (health, cache, rejects).

### 1.3 Traffic classes

| Class | Examples | Can approach multi-M RPS? |
| --- | --- | --- |
| **A — Cheap** | `/health`, `/metrics`, cache HIT, early 401/429 | Yes (edge + thin proxy) |
| **B — Gateway miss** | Auth + route + stream to provider | Limited by fleet + providers |
| **C — Live LLM completion** | Full model generation | Limited by **provider capacity and $** |

Scaling plans must state which class they target.

---

## 2. Reality check: “millions of RPS”

| Scale (order of magnitude) | Typical context |
| --- | --- |
| **10²–10³ RPS** | Serious multi-tenant chat API |
| **10³–10⁴ RPS** | Large regional gateway (good caching, multi-AZ) |
| **10⁴–10⁵ RPS** | Edge + multi-region + high cache / admission |
| **10⁶+ RPS** | Global edge; mostly class A; origin LLM RPS far lower |

**Product implication:** AI Hay should publish **gateway RPS** and **completion RPS** separately. Never market “1M RPS” if that counts only edge rejects or health checks.

**Economic implication:** 1M full frontier completions/sec is not a startup gateway roadmap; it is a capacity + capital problem with model labs and clouds.

---

## 3. Principles (locked)

1. **Hot path stays thin** — memory/Redis + upstream + async meter only.  
2. **Stream-through** — never buffer full bodies; failover only **pre-commit**.  
3. **Stateless data-plane replicas** — no sticky sessions.  
4. **Postgres off the byte path** — keys cached; usage enqueued, not sync-inserted before first token.  
5. **Measure before rewrite** — TypeScript is fine until metrics show CPU/stream limits.  
6. **Control plane never blocks chat** — dashboard/billing/auth UI out of band ([Architecture V2](./architecture-v2.md)).  
7. **Admission over collapse** — prefer early 429/503 to melting Redis/DB/providers.  
8. **Cardinality discipline** — metrics/logs must not DDoS the observability stack.

---

## 4. Current baseline (V1) limits

| Component | Role | Scale risk |
| --- | --- | --- |
| Hono / Node | Data plane | Per-process concurrent streams & memory |
| Postgres | Keys, usage ledger | Hot-path lookups/writes |
| Redis | RPM, optional cache | Single instance; fail-open local limiter |
| Compose single region | Deploy | No multi-AZ / multi-region |
| Structured logs only | Ops | No metrics SLOs yet |
| Platform provider keys | Inference | Quotas and cost cliffs |

V1 is appropriate for **dev, self-host, and early production**. It is **not** a multi-million-RPS design by itself.

---

## 5. Scaling stages

### Stage 0 — Single stack (today)

**Shape:** `docker compose` · few `api` processes · memory or single Postgres/Redis.

**Target:** tens–low hundreds of concurrent streams; **O(10¹–10²)** completion RPS depending on models.

**Must remain true:**

- Horizontal-ready (stateless API)  
- Usage async-capable  
- Stream-through  

---

### Stage 1 — Regional production

**Target:** **O(10²–10³)** completion RPS (provider-limited); higher pure-gateway RPS.

| Lever | Design |
| --- | --- |
| **Compute** | N stateless `api` replicas; HPA on CPU, lag, or concurrency |
| **LB** | L7; timeouts and buffering **disabled** for SSE paths |
| **Auth** | Redis cache `key_hash → key metadata`; short TTL; invalidate on revoke |
| **Limits** | Redis token bucket / fixed window; hierarchical limits later |
| **Metering** | Enqueue (Redis stream / NATS / SQS / Kafka) → worker batch INSERT |
| **Postgres** | Primary for control + keys; partition/archive `usage_events`; read replicas for dashboards |
| **Providers** | Multi-key, multi-endpoint, circuit breakers |
| **Observability** | Completion logs + Prometheus ([Impl Plan V2.0](./implementation-plan-v2.md)) |

**Hot path allowlist**

```text
request
  → Redis auth + RPM
  → validate + resolve model (in-memory registry snapshot)
  → upstream stream
  → async meter enqueue
  → access log + metrics
```

---

### Stage 2 — Multi-region + edge

**Target:** **O(10³–10⁴)** origin gateway RPS; edge can be much higher (class A).

```text
Client
  → Global edge (TLS, WAF, bot, geo, cheap rate limit, optional cache)
  → Regional anycast / DNS
  → Regional L7 → data-plane pool
  → Providers (prefer same-region endpoints)
```

| Lever | Design |
| --- | --- |
| **Edge** | Cloudflare / CloudFront / similar in front of API |
| **Regions** | Active-active data planes; independent Redis per region |
| **Key material** | Replicated or globally readable control data; **revokes** fan out async (brief inconsistency window documented) |
| **Config** | Model registry push/hot reload; not full DB round-trip per request |
| **Exact cache** | Optional Redis/edge cache for **safe** idempotent workloads |
| **Residency** | Optional `eu.` / `us.` hostnames for compliance |

**Exact cache rules (if enabled)**

- Key: hash(workspace, model, normalized messages, critical params)  
- Never cache personalized high-risk content without policy  
- Meter `cache_hit` distinctly from upstream success  

---

### Stage 3 — Hyperscale gateway (multi-M HTTP class)

**Target:** **O(10⁵–10⁶+)** class **A/B** gateway operations with high cache/admission; live LLM RPS still provider-bound.

Requires a **layered data plane**:

```text
Edge
  → Hot proxy fleet (Go / Rust / Envoy-class)
       · HMAC/key verify, quota, route table, stream splice
  → Complex adapter workers (TypeScript or specialized)
       · Anthropic reshape, tools/vision, rare paths
  → Async telemetry bus → billing / OLAP
  → Provider mesh (many accounts, health-aware LB)
```

| Lever | Design |
| --- | --- |
| **Language split** | Hot path ≠ product/control plane language if metrics demand |
| **Connection scale** | Dedicated ingress + egress pools; FD and buffer tuning |
| **Metering** | Local aggregate → Kafka → ClickHouse/BigQuery; not OLTP row-per-request at peak |
| **Fairness** | Hierarchical limits: global → org → workspace → key |
| **Isolation** | Noisy-neighbor pools / separate queues per tier |
| **Control plane** | Fully isolated deployable ([Architecture V2](./architecture-v2.md)) |

**Do not** start Stage 3 until Stage 1–2 metrics prove Node/proxy CPU or concurrency is the bottleneck—not Postgres, Redis, or providers.

---

## 6. Capacity model (back of envelope)

### 6.1 Gateway-only CPU (illustrative)

If warm auth+route costs **~0.5–2 ms** CPU equivalent per request:

| Fleet | Rough class-B RPS (order of magnitude) |
| --- | --- |
| 10 × 4 vCPU | low thousands |
| 100 × 8 vCPU | tens of thousands |
| 1,000+ cores specialized proxy | high tens of thousands–low hundreds of thousands |

SSE and large JSON push real capacity **down**. Treat these as **planning orders of magnitude**, not SLAs.

### 6.2 Concurrent streams

```text
concurrent ≈ arrival_RPS × avg_stream_duration_sec
```

Plan memory and proxy limits around **concurrent streams**, not peak RPS alone.

### 6.3 Cost ceiling

```text
$/sec ≈ completion_RPS × avg_tokens × $/token
```

Provider cost usually caps “LLM RPS” before proxy CPU does.

---

## 7. Component scaling notes

### 7.1 Data plane (`apps/api`)

| Do | Don’t |
| --- | --- |
| Horizontal replicas | Sticky sessions |
| In-memory registry snapshot + reload | DB query per model resolve on hot path |
| Stream splice / transform only | Full body buffer |
| Bounded attempts | Unbounded failover storms |

### 7.2 Redis

| Use | Avoid |
| --- | --- |
| Auth cache, RPM, circuits, exact cache | Storing prompts |
| Cluster at Stage 1+ | Single instance as multi-region SPOF |
| Fail closed or degrade with explicit mode | Silent unlimited fail-open in multi-tenant prod |

### 7.3 Postgres

| Use | Avoid |
| --- | --- |
| Keys (source of truth), control plane, billing | Sync INSERT before first token at scale |
| Partitioned usage or ship to OLAP | Unbounded `usage_events` on one table forever |
| Read replicas for dashboards | Dashboard queries on primary under load |

### 7.4 Metering & analytics

| Stage | Pattern |
| --- | --- |
| V1 | Async insert to Postgres |
| Stage 1 | Queue + batch writer |
| Stage 2–3 | Stream processing + OLAP; wallet/balances still strongly consistent where required |

### 7.5 Providers

- Health-aware selection and circuits  
- Multiple credentials / regions  
- Separate **egress** connection pools  
- Clear 429 propagation and client `Retry-After`  

### 7.6 Observability at scale

| Signal | High-RPS practice |
| --- | --- |
| Logs | Sample successes; always log errors; completion log required but may sample fields |
| Metrics | Low cardinality; no raw `api_key` labels |
| Traces | Tail-sample errors/slow requests only |

See Architecture V2 §8 and Implementation Plan V2.0.

---

## 8. Roadmap mapping (product phases)

| Product phase | Scalability focus |
| --- | --- |
| **V1** | Correctness, stream-through, basic HA shape |
| **V2.0** | Metrics + completion logs (know the truth) |
| **V2.1–V2.3** | Tenancy; keep data plane isolated from control plane load |
| **V2.4** | Budgets / admission (protect $ and upstream) |
| **V2.5+** | BYOK (more egress diversity); still same scale rules |
| **Infra Stage 2** | Multi-region + edge (ops program) |
| **Infra Stage 3** | Optional Go/Envoy hot path (only if measured) |
| **V3 smart routing** | Extra CPU risk—must be async/side path or tiny models |

---

## 9. SLOs (suggested)

| SLO | Stage 1 target | Notes |
| --- | --- | --- |
| Gateway overhead p50 | ≤ 15 ms | Excluding provider (V1 hold) |
| Gateway overhead p99 | ≤ 50 ms | Regional, warm |
| Availability (data plane) | 99.9% monthly | Multi-AZ |
| Usage lag | &lt; 5–30 s to durable ledger | Async OK |
| Cache (if enabled) | Document hit ratio goals per workload | Not global vanity |

LLM **end-to-end** latency SLOs are **per model/provider**, not pure gateway SLOs.

---

## 10. Load testing guidance

| Test | Goal |
| --- | --- |
| **Auth+models only** | Pure gateway RPS ceiling |
| **Synthetic upstream** (mock SSE) | Stream concurrency without provider $ |
| **Live canary** | Real TTFT/quality; small RPS |
| **Failover** | Kill primary provider; measure success + attempt counts |
| **Metering lag** | Flood completions; watch queue depth / insert lag |
| **Noisy neighbor** | One key at limit; others unaffected |

Never load-test production provider keys at abusive rates.

---

## 11. Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Sync Postgres usage on hot path | Write amplification death spiral |
| Logging full prompts at high RPS | Cost, privacy, I/O |
| Unbounded in-memory queues | OOM under burst |
| Sticky sessions to “hold stream state” | Breaks scale-out |
| One Redis without memory limits | Entire platform outage |
| Chasing 1M LLM RPS before edge/cache | Wrong bottleneck |
| Rewriting to Go before metrics | Opportunity cost |
| Dashboard queries on primary under load | Chat auth timeouts |

---

## 12. Decision tree

```text
Are we provider-throttled or $ bound?
  YES → buy capacity / cache / cheaper models / admission
  NO  → continue

Is Postgres/Redis the cliff (latency, connections, CPU)?
  YES → cache, async, partition, cluster
  NO  → continue

Is Node CPU or concurrent stream memory the cliff?
  YES → more replicas; then consider specialized hot proxy
  NO  → multi-region / edge for latency and blast radius
```

---

## 13. Summary

| Goal | Approach |
| --- | --- |
| **Reliable growth** | Stateless replicas, Redis auth/limits, async metering, multi-AZ |
| **Global UX** | Edge + multi-region + provider locality |
| **Apparent multi-M RPS** | Edge + cache + admission; measure class A vs C separately |
| **True hyperscale proxy** | Specialized hot path + bus + OLAP; TS remains control/adapters |
| **Live multi-M LLM completions/sec** | Not a realistic AI Hay V1–V2 product goal |

**AI Hay scales by staying a thin, measurable, horizontally replicated gateway first—and by not confusing proxy RPS with inference RPS.**

---

## 14. Related docs

| Doc | Relevance |
| --- | --- |
| [Architecture V1](./architecture-v1.md) | Hot path laws, stream commit, performance budgets |
| [Architecture V2](./architecture-v2.md) | Control vs data plane, observability, multi-tenant |
| [Implementation Plan V2](./implementation-plan-v2.md) | V2.0 metrics/logs as first scale enabler |
| [Runbook](../runbook.md) | Operate today’s Compose/single-region deploy |
| [TS performance notes](../typescript-performance-ai-router.md) | Why TS is enough until it isn’t |

---

*Scalability design — living document. Update when stages, SLOs, or hot-path technology choices change.*
