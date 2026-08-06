# AI Hay Router — Architecture Design (V1)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Architecture design (V1) |
| **Status** | Ready to build (synced with Product Spec + Implementation Plan) |
| **Last updated** | 2026-08-05 |
| **Companions** | [Product Specification](./product-spec.md) · [Implementation Plan V1](./implementation-plan-v1.md) · [Architecture V2](./architecture-v2.md) (next) |
| **Primary stack** | TypeScript · Hono · Postgres · Redis · Docker Compose |
| **First release tag** | `v0.1.0` |

This document turns the product spec and market research into a **buildable V1 system design**. It answers: *what we run, how a request flows, what we store, what we deliberately leave out.*

---

## 1. Design intent

### 1.1 What V1 is

V1 is a **gateway with simple routing**:

| Layer | V1 behavior |
| --- | --- |
| **Aggregator** | One OpenAI-compatible API, one AI Hay key, multi-model IDs |
| **Gateway** | Auth, validation, timeouts, retries, failover plumbing, metering, logs |
| **Router** | Registry lookup + ordered provider attempts + optional model fallbacks |

V1 is **not** a learned auto-router. Intelligent model selection (classifiers, preference models, eval-linked routing) is Phase 3. Research shows static maps + failover + metering beat half-trained “smart” routers until quality is measurable.

### 1.2 Architecture principles (locked)

1. **The product is the wire contract** — OpenAI Chat Completions compatibility first.
2. **Stream-through, never buffer-then-forward** — protect TTFT and memory.
3. **Two routing layers, explicit** — model resolution, then provider selection.
4. **Adapters own vendor quirks** — core pipeline stays provider-agnostic.
5. **Meter every terminal request** — one usage row per request outcome (with attempt metadata); cost control starts with a ledger.
6. **Stateless API instances** — scale horizontally; durable state in Postgres/Redis.
7. **Honest defaults** — no silent quality downgrades without config.
8. **Inference latency dominates** — gateway overhead target p50 ≤ 15 ms warm (same region).
9. **Stream commit is final** — no mid-stream model/provider switch after first client byte.
10. **Text chat first** — tools/vision out of V1 DoD unless explicitly approved as stretch.

### 1.3 Category placement (from research)

```text
App ──► AI Hay V1 ──► Providers
         │
         ├── Gateway jobs: auth, limits, logs, failover plumbing
         └── Router jobs:  which model ID? which upstream host?
```

Closest market analogues:

| Product | What we take | What we defer |
| --- | --- | --- |
| **OpenRouter** | Dual-layer model/provider routing, SSE, credits later, metadata-first privacy | 400-model catalog, Auto, full marketplace |
| **LiteLLM** | Adapter pattern, self-host path | Python ops model, 100+ adapters day one |
| **Portkey** | Retries, circuit-style failover, observability mindset | Enterprise governance surface |

**Positioning:** TypeScript-native unified LLM API; ownable control plane; transparent policy; quality adapters over catalog vanity.

---

## 2. System context

```text
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                                        │
│  OpenAI SDK · Python OpenAI SDK · curl · agents · internal apps │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             │ Authorization: Bearer sk-aihay-...
                             │ POST /v1/chat/completions
                             │ GET  /v1/models
                             │ GET  /health
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Hay Router (V1) — TypeScript services                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ API edge │→│ Pipeline │→│ Adapters │→│ Metering │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│        │             │                         │                │
│        ▼             ▼                         ▼                │
│   Redis (limits)  Registry (config/DB)    Usage queue → PG      │
└────────┬───────────────────────────────┬────────────────────────┘
         │                               │
         ▼                               ▼
   Postgres                         Upstream inference
   (keys, models,                   OpenAI · Anthropic
    usage ledger)                   (path to 3rd later)
```

### 2.1 External actors

| Actor | Relationship |
| --- | --- |
| **Developer / app** | Calls AI Hay with AI Hay API key |
| **Upstream providers** | OpenAI, Anthropic (V1); hold inference; AI Hay holds platform keys |
| **Operator** | Deploys Docker stack; manages env secrets and model catalog |
| **Billing (later)** | Not in V1 runtime path; metering prepares for it |

### 2.2 Trust boundaries

| Boundary | Rule |
| --- | --- |
| Client ↔ AI Hay | TLS; Bearer AI Hay keys only (never raw provider keys in V1 client path) |
| AI Hay ↔ providers | Platform provider credentials from secret store / env |
| Process ↔ DB | Network-restricted Postgres; least-privilege app role |
| Logs | Metadata by default; no full prompt/completion storage in V1 |

---

## 3. Runtime topology

### 3.1 Processes (V1 deploy)

| Process | Role | Scale unit |
| --- | --- | --- |
| **`api`** | HTTP API + request pipeline + stream proxy | Horizontal (N replicas) |
| **`worker` (optional V1)** | Async usage flush, retries of failed ledger writes | 1–N |
| **Postgres** | Durable keys, registry, usage | Managed single primary OK for V1 |
| **Redis** | Rate limits, short-lived auth cache, optional circuit flags | Single instance OK for V1 |

V1 may ship **api-only** with synchronous usage insert if volume is low; introduce `worker` when write path threatens p99.

### 3.2 Statelessness contract

API instances must **not** require sticky sessions. Any replica may:

- Authenticate a key (Redis/Postgres)
- Serve chat completions
- Stream SSE to the client

In-memory state is limited to:

- Process-local caches with TTL (registry snapshot, key hash → key id)
- In-flight abort controllers for active streams

### 3.3 Deployment shape

```text
Docker Compose (self-host / single-tenant managed)
├── api          # Hono on Node 22+ or Bun
├── postgres
├── redis
└── (optional) worker
```

Public URL terminates TLS at reverse proxy / platform (Caddy, Fly, Railway, ALB, Cloudflare). API listens plain HTTP inside the mesh.

---

## 4. Logical components

### 4.1 Component map

| Component | Module responsibility | V1 scope |
| --- | --- | --- |
| **HTTP edge** | Routes, CORS, request id, SSE headers | Full |
| **Auth** | Bearer parse, key hash verify, key metadata load | Full |
| **Rate limiter** | Per-key RPM (fixed window or token bucket) via Redis | Basic V1 |
| **Spend floor** | Default/clamp max_tokens; optional per-key daily token/$ soft cap | Basic V1 |
| **Validator** | Zod schemas for chat + models list; reject vision/tools if out of policy | Full |
| **Registry** | Model id → provider, upstream id, pricing, capabilities, endpoint order | Full |
| **Router** | Resolve model; build attempt plan (endpoints + model fallbacks); pre-commit only for stream | Full |
| **Adapter host** | Dispatch to provider adapter; enforce timeout | Full |
| **Adapters** | OpenAI, Anthropic request/response/stream mapping | ≥ 2 |
| **Stream proxy** | Pipe/transform SSE chunks; abort propagation | Full |
| **Metering** | UsageEvent write (async preferred) | Full |
| **Error normalizer** | Map upstream/errors → OpenAI-like JSON | Full |
| **Health** | Liveness + readiness (DB/Redis optional checks) | Full |
| **Admin API** | Key CRUD, model CRUD | Minimal (CLI/SQL OK) |
| **Dashboard** | UI | Out of V1 |
| **Billing / credits** | Stripe, prepaid balance | Out of V1 |
| **Smart auto router** | Classifier / preference model | Out of V1 |
| **Semantic cache** | Embed + similarity | Out of V1 |

### 4.2 Suggested package layout

```text
packages/          # monorepo optional; single app also fine
apps/api/
  src/
    server.ts                 # bootstrap
    app.ts                    # Hono app wiring
    config.ts                 # env (Zod)
    middleware/
      request-id.ts
      auth.ts
      rate-limit.ts
      error-handler.ts
    routes/
      chat-completions.ts
      models.ts
      health.ts
    pipeline/
      handle-chat.ts          # orchestrates one request
      attempt-plan.ts         # builds failover chain
      execute-attempt.ts
    registry/
      types.ts
      load.ts                 # YAML + DB merge
      resolve.ts
    providers/
      types.ts                # Adapter interface
      openai/
      anthropic/
      stream/
        sse.ts
        transform.ts
    metering/
      usage.ts
      cost.ts
    db/
      schema.ts               # Drizzle/Kysely/pg
      keys.ts
      usage.ts
    lib/
      hash.ts
      logger.ts
      otel.ts                 # optional stubs
  models.yaml                 # seed catalog
  Dockerfile
docker-compose.yml
```

### 4.3 Adapter interface (contract)

Every provider adapter implements a narrow interface so the pipeline stays stable:

```ts
// Conceptual contract — not production code freeze
interface ChatAdapter {
  readonly id: "openai" | "anthropic" | string;

  /** Map OpenAI-shaped chat request → provider HTTP call inputs */
  buildRequest(input: NormalizedChatRequest, upstreamModel: string): ProviderHttpRequest;

  /** Non-stream: provider JSON → OpenAI chat.completion */
  parseResponse(raw: unknown, ctx: AttemptContext): ChatCompletion;

  /** Stream: provider bytes/events → OpenAI SSE chunks (async iterable) */
  stream(raw: ReadableStream, ctx: AttemptContext): AsyncIterable<SseChunk>;

  /** Classify provider errors for retry/failover decisions */
  classifyError(err: ProviderError): ErrorClass; // retriable | fatal | rate_limit
}
```

**Adapter rules:**

- Core never imports provider SDKs except inside `providers/*`.
- Streaming path must not materialize the full completion before first client byte.
- Token usage: prefer provider-reported; else estimate and flag `usage_estimated: true` in ledger.

---

## 5. Request lifecycle

### 5.1 Happy path (non-stream)

```text
1.  Accept HTTP → attach request_id
2.  Auth: Bearer → hash → load ApiKey (cache miss → Postgres)
3.  Rate limit: Redis INCR/token-bucket; 429 if exceeded
4.  Validate body (Zod): model, messages, stream, temperature, …
5.  Registry.resolve(model) → LogicalModel + ProviderEndpoints[]
6.  Router.buildPlan():
      attempts = flatten(endpoints × optional models fallback list)
7.  For attempt in attempts (bounded):
      a. adapter.buildRequest
      b. fetch with timeout + AbortSignal
      c. on success → parseResponse → break
      d. on retriable → next attempt; record AttemptTrace
8.  Metering.enqueue(UsageEvent)  // non-blocking
9.  Return OpenAI-shaped JSON + headers (x-request-id, optional x-aihay-model/provider)
```

### 5.2 Happy path (stream)

```text
1–6  same as non-stream
7.  Open upstream stream on first viable attempt
8.  Set SSE headers; flush immediately (disable proxy buffering where needed)
9.  For each upstream chunk:
      transform → write to client (no full-body accumulate)
10. On final usage (if any) → include in final chunk / separate meter event
11. Client disconnect → abort upstream
12. Meter on terminal state (success, client abort, upstream fail after retries)
```

### 5.3 Failover plan

Two distinct mechanisms (aligned with OpenRouter mental model):

| Mechanism | Meaning | V1 support | V1 realism |
| --- | --- | --- | --- |
| **Provider multi-endpoint** | Same logical model, next host/credentials | Structure yes — ordered endpoints in registry | Needs dual keys/regions; often empty day one |
| **Model fallback** | Different model after model-level failure | Yes — `models: string[]` or registry `fallback_models` | **Primary reliability demo** (OpenAI → Anthropic) |

```text
Plan example for model "openai/gpt-4o-mini" with fallback "anthropic/claude-3-5-haiku":

  Attempt 1: openai   / gpt-4o-mini
  Attempt 2: openai   / gpt-4o-mini   (secondary key/region if configured)
  Attempt 3: anthropic / claude-3-5-haiku   (model fallback)
```

**Retry policy (V1 defaults):**

| Condition | Action |
| --- | --- |
| Upstream 408 / 429 / 5xx | Next attempt (if still allowed — see stream commit) |
| Network timeout / reset | Next attempt |
| 400 validation / 401 from provider | Fail fast (config bug); do not spin |
| Max attempts | Default **3**; hard cap **5** |
| Total wall budget | e.g. **120s** request deadline (configurable) |

No infinite fallback loops. Each attempt logged with `request_id` + `attempt_n`.

### 5.3.1 Stream commit rule (locked)

Transparent multi-attempt failover **must not** break the OpenAI client stream contract.

| Mode | Rule |
| --- | --- |
| **Non-stream** | Try attempts `1..N` until success or exhausted |
| **Stream** | Only try further attempts **before** the response is committed to the client (i.e. before/at first client SSE byte after a viable upstream). After commit: **no** model/provider switch. Mid-stream upstream failure → end stream with error semantics + meter partial usage |
| **Logging** | Record `attempt_count`, failed attempts in logs/optional trace; **one** `usage_events` row for the terminal request |

```text
Stream timeline:

  [attempt 1 fails] → [attempt 2 opens upstream OK] → COMMIT to client
       ↑ still free to failover                      ↑ no more failover
```

### 5.4 Sequence diagram (stream + failover)

```text
Client          API            Redis/PG        Adapter         Provider
  │              │                │               │               │
  │─ POST stream─►│                │               │               │
  │              │─ auth/limit ───►│               │               │
  │              │◄─ ok ───────────│               │               │
  │              │─ resolve model ─►│ (registry)   │               │
  │              │─ attempt 1 ────────────────────►│── POST ───────►│
  │              │                                 │◄── 503 ───────│
  │              │─ attempt 2 ────────────────────►│── POST ───────►│
  │              │◄════ SSE bytes ═════════════════│◄══ stream ════│
  │◄════ SSE ════│  (pipe/transform)               │               │
  │              │─ enqueue usage ─►│               │               │
  │              │                 │               │               │
```

---

## 6. Routing design (V1)

### 6.1 Layers

```text
request.model
    │
    ▼
┌─────────────────────┐
│  Model resolution   │  alias → canonical id → LogicalModel
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Provider selection │  ordered endpoints for that model
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Adapter execution  │  translate · call · normalize
└─────────────────────┘
```

### 6.2 Model ID scheme

| Pattern | Example | V1 |
| --- | --- | --- |
| Canonical | `openai/gpt-4o-mini` | **DoD** — direct registry key |
| Canonical | `anthropic/claude-…` | **DoD** — direct registry key |
| Alias | `aihay/cheap` | **Out of V1 DoD** (Phase 2) |
| Auto | `aihay/auto` | **Not in V1** (return clear 400) |

### 6.3 Registry record (logical)

```yaml
# models.yaml (seed) — also loadable from DB
models:
  - id: openai/gpt-4o-mini
    provider: openai
    upstream_id: gpt-4o-mini
    context_length: 128000
    supports_tools: true
    supports_streaming: true
    input_price_per_mtok: 0.15    # USD / 1M tokens (illustrative)
    output_price_per_mtok: 0.60
    endpoints:
      - id: openai-primary
        base_url: https://api.openai.com/v1
        credential_ref: OPENAI_API_KEY
        priority: 1
    fallback_models: []           # optional chain

  - id: anthropic/claude-3-5-haiku-latest
    provider: anthropic
    upstream_id: claude-3-5-haiku-latest
    # ...
```

Registry is the **source of truth** for pricing estimates, capability gates (e.g. tools), and endpoint order.

### 6.4 Explicit non-behavior (V1)

- No price-weighted multi-provider load balancing across hosts of the “same” open-weight model (OpenRouter-scale catalog problem; we don’t have that yet).
- No latency/throughput percentile sorting.
- No ZDR / data_collection filters (Phase 2–3).
- No silent swap to a cheaper model unless the client or registry fallback list opts in.

---

## 7. Public API surface

### 7.1 Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | Stream + non-stream |
| `GET` | `/v1/models` | Active models from registry |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Optional readiness (DB reachable) |

### 7.2 Compatibility target

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.aihay.example/v1",
  apiKey: process.env.AIHAY_API_KEY,
});

const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
  stream: true,
});
```

### 7.3 AI Hay extensions (non-breaking)

Prefer optional fields that standard SDKs ignore, or document `extra_body`:

| Extension | Purpose |
| --- | --- |
| `models: string[]` | Model fallback list after primary fails |
| `provider.order` | Future; stub ignored or partial in V1 |
| `provider.allow_fallbacks` | Default true |

Response headers (recommended):

| Header | Value |
| --- | --- |
| `x-request-id` | Correlation id |
| `x-aihay-model` | Actual model served |
| `x-aihay-provider` | Actual provider/endpoint id |

### 7.4 Error shape

Normalize to OpenAI-like:

```json
{
  "error": {
    "message": "Unknown model: foo/bar",
    "type": "invalid_request_error",
    "code": "model_not_found",
    "param": "model"
  }
}
```

Map classes:

| Situation | HTTP | type / code |
| --- | --- | --- |
| Bad key | 401 | `authentication_error` |
| Rate limited | 429 | `rate_limit_error` |
| Unknown model | 400 | `invalid_request_error` / `model_not_found` |
| All upstreams failed | 502 | `api_error` / `upstream_unavailable` |
| Validation | 400 | `invalid_request_error` |

---

## 8. Data model

### 8.1 ER overview

```text
Workspace 1──* ApiKey
Workspace 1──* UsageEvent
Model (registry) ── referenced by UsageEvent.model_id (string ok)
ProviderCredential ── platform secrets (or env-only in MVP)
RequestTrace (optional) 1──* Attempt
```

### 8.2 Tables (minimum)

#### `workspaces`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text | |
| `created_at` | timestamptz | |

V1 may use a single default workspace.

#### `api_keys`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK | |
| `name` | text | human label |
| `key_prefix` | text | e.g. `sk-aihay-…` first chars for UI |
| `key_hash` | text unique | **HMAC-SHA256(secret, pepper)** — high-entropy API keys, not passwords |
| `rate_limit_rpm` | int null | Basic V1 abuse floor |
| `daily_token_limit` | bigint null | Optional spend floor |
| `daily_cost_usd_limit` | numeric null | Optional spend floor |
| `revoked_at` | timestamptz null | |
| `created_at` | timestamptz | |

Secret shown **once** at creation; only hash stored. Prefer HMAC+pepper over argon2 for API keys (random secrets; auth is cache-friendly).

#### `models` (optional DB; YAML acceptable for V1)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | `provider/model` |
| `provider` | text | adapter id |
| `upstream_id` | text | |
| `input_price_per_mtok` | numeric | |
| `output_price_per_mtok` | numeric | |
| `context_length` | int | |
| `supports_tools` | bool | |
| `active` | bool | |
| `config` | jsonb | endpoints, fallbacks |

#### `usage_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `request_id` | text | client-visible |
| `api_key_id` | uuid FK | |
| `workspace_id` | uuid FK | |
| `model_requested` | text | |
| `model_used` | text | after fallbacks |
| `provider` | text | |
| `endpoint_id` | text null | |
| `prompt_tokens` | int | |
| `completion_tokens` | int | |
| `cost_usd_estimate` | numeric | |
| `usage_estimated` | bool | |
| `latency_ms` | int | |
| `ttft_ms` | int null | stream |
| `status` | text | success / error / aborted |
| `error_code` | text null | |
| `attempt_count` | int | |
| `created_at` | timestamptz | |

**Indexes:** `(workspace_id, created_at desc)`, `(api_key_id, created_at desc)`, `(request_id)`.

#### `request_traces` (optional V1)

Store attempt list for debugging without storing prompts:

```json
{
  "request_id": "...",
  "attempts": [
    { "n": 1, "provider": "openai", "status": 503, "ms": 120 },
    { "n": 2, "provider": "openai", "status": 200, "ms": 840 }
  ]
}
```

### 8.3 Privacy defaults

| Data | V1 default |
| --- | --- |
| Prompts / completions | **Not stored** |
| Token counts, model, latency, status | Stored |
| IP / user-agent | Optional; prefer minimal |
| Provider secrets | Env or encrypted column; never log |

---

## 9. Auth, limits, security

### 9.1 Authentication

```text
Authorization: Bearer sk-aihay-<secret>
  → extract secret
  → hash
  → lookup api_keys by key_hash
  → reject if missing / revoked
```

Hot path optimization: Redis cache `key_hash → { id, workspace_id, rpm, revoked }` with short TTL (30–60s). Invalidate on revoke.

### 9.2 Rate limiting and spend floor

| Control | V1 | Storage |
| --- | --- | --- |
| Per-key RPM | **Required** (basic abuse floor) | Redis |
| Default / max clamp on `max_tokens` | **Required** | Config |
| Per-key daily token or $ soft cap | **Recommended** | Redis counters + key metadata |
| Workspace budgets UI | Phase 2 | — |
| Global process protection | Optional | Redis / in-process |

On RPM exceed: `429` + `Retry-After`.  
On daily cap exceed: `429` with clear `code` (e.g. `daily_limit_exceeded`).

**Why:** V1 holds **platform** provider keys; a leaked AI Hay key spends operator money. RPM alone is not enough for internet-exposed deploys.

### 9.3 Secrets

| Secret | Storage |
| --- | --- |
| AI Hay API keys | Hash only |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Env / secret manager; never client-supplied in V1 |
| DB credentials | Env |

### 9.4 Threat notes (V1 baseline)

| Threat | Mitigation |
| --- | --- |
| Key leak | Hash at rest; prefix display; revoke |
| Cost runaway | RPM limits; optional max_tokens clamp |
| SSRF via custom base_url | **Disallow** client-specified upstream URLs in V1 |
| Prompt injection into logs | Don’t log body by default |
| Stream abuse | Timeouts, max duration, disconnect abort |

---

## 10. Streaming architecture

Streaming is the **primary** production path. Design constraints from performance research:

| Rule | Rationale |
| --- | --- |
| Pipe chunks; no `await response.text()` | Preserve TTFT |
| Minimize per-chunk allocations | Reduce GC jitter |
| Propagate `AbortSignal` | Client cancel stops provider spend |
| One transform layer per adapter | Keep hot path shallow |
| Usage finalization after stream end | Don’t block first token on DB |

### 10.1 SSE contract

- `Content-Type: text/event-stream`
- Chunks compatible with OpenAI streaming chat chunks
- Terminal `data: [DONE]` when expected by clients
- Flush headers before first model token when possible

### 10.2 Backpressure

If the client is slow, prefer **propagation** (pause reading upstream) over unbounded buffering. Cap internal buffer size; on overflow, abort with logged error.

---

## 11. Metering & cost

### 11.1 Cost estimate

```text
cost_usd ≈
  (prompt_tokens / 1e6) * input_price_per_mtok
  + (completion_tokens / 1e6) * output_price_per_mtok
```

Prices come from registry. Store **raw tokens + estimate**; reconcile later if billing appears.

### 11.2 Write path

**Preferred:** enqueue to Redis list / PG `LISTEN` / in-process queue → worker inserts.

**Acceptable MVP:** fire-and-forget async insert after response starts/finishes; never block stream setup on metering I/O beyond a few ms budget.

### 11.3 What gets a usage row

**One `usage_events` row per terminal client request**, not one row per failed hop.

| Outcome | Meter? |
| --- | --- |
| Full success | Yes (`attempt_count` ≥ 1) |
| Stream partial then client abort | Yes (tokens known / estimated; status=aborted) |
| All attempts failed | Yes (status=error; tokens may be 0) |
| Auth failure before model | Optional lightweight audit; not full usage |

Failed attempts belong in **logs / optional request_traces**, not as separate billable usage rows.

---

## 12. Observability

| Signal | V1 requirement |
| --- | --- |
| **request_id** | Every response header + all logs |
| **Structured logs** | JSON: level, request_id, key_id, model, provider, latency, status |
| **Metrics** (optional) | request count, error rate, TTFT histogram, attempt count |
| **Tracing** | OpenTelemetry stubs OK; full traces nice-to-have |
| **Prompt logging** | Off by default |

Log fields to **avoid**: full `messages`, API keys, provider secrets.

---

## 13. Technology choices (V1 lock)

| Layer | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | Product velocity; shared types; edge path later |
| Runtime | **Node 22+ LTS** (Bun optional) | Stable streams; ecosystem |
| HTTP | **Hono** | Lightweight, streaming-friendly, edge-portable |
| Validation | **Zod** | Runtime + inferred types |
| DB access | **Drizzle or Kysely + Postgres** | Typed SQL without heavy ORM |
| Redis | **ioredis** or **node-redis** | Limits + cache |
| HTTP client | **fetch** (undici) | Streaming body support |
| Config | **env + models.yaml** | Ship fast; DB registry can supersede |
| Deploy | **Docker Compose** | Self-host MVP |
| Tests | **Vitest** + contract tests per adapter | Catch provider drift |

**Not V1:** NestJS (heavier), Prisma middleware-heavy hot path, Python core (split stack), Go data plane (premature until metrics demand).

### 13.1 Performance budget

| Metric | Target |
| --- | --- |
| Gateway overhead p50 (warm, same region) | **1–15 ms** |
| Gateway p99 moderate load | **&lt; 30 ms** |
| Extra TTFT vs direct provider | **&lt; 30 ms** same region |
| Streaming | First client byte not gated on full upstream body |

If budgets fail, profile **architecture** (remote DB on hot path, buffering, cold start) before blaming TypeScript.

---

## 14. Provider adapter notes

### 14.1 OpenAI adapter

- Near-passthrough for Chat Completions.
- Upstream base: platform `OPENAI_API_KEY`.
- Map AI Hay model id → `upstream_id`.
- Stream: forward SSE with light rewrites if needed (model field → requested id).

### 14.2 Anthropic adapter

- Translate messages: system → top-level `system`; roles/content blocks.
- Headers: `x-api-key`, `anthropic-version`.
- Map streaming events (`content_block_delta`, etc.) → OpenAI chunk shape.
- **V1 DoD:** text-only. Reject tools/vision with clear 400 unless an approved stretch lands.

### 14.3 Capability gates (V1 content policy)

| Input | V1 behavior |
| --- | --- |
| Text `messages` | Allow |
| `tools` / `functions` / tool_calls | **400** `unsupported_parameter` (stretch: OpenAI passthrough only) |
| Image / vision parts | **400** |
| Registry `supports_tools: false` | Enforce even if stretch disabled |

Do not send broken upstream calls for unsupported features.

### 14.4 Adapter test matrix (V1 DoD)

| Test | OpenAI | Anthropic |
| --- | --- | --- |
| Non-stream hello (text) | ✓ | ✓ |
| Stream hello (text) | ✓ | ✓ |
| Reject tools/vision with 400 | ✓ | ✓ |
| 429 classification | ✓ | ✓ |
| Usage parse / estimate | ✓ | ✓ |
| Abort mid-stream | ✓ | ✓ |
| Tool round-trip | Stretch only | Out |

---

## 15. Configuration surface

### 15.1 Environment (illustrative)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | Redis |
| `OPENAI_API_KEY` | Platform OpenAI |
| `ANTHROPIC_API_KEY` | Platform Anthropic |
| `AIHAY_KEY_PEPPER` | HMAC pepper for API key hashing |
| `PORT` | Listen port |
| `LOG_LEVEL` | info/debug |
| `REQUEST_TIMEOUT_MS` | Upstream timeout |
| `MAX_ATTEMPTS` | Failover cap |

### 15.2 Feature flags (simple)

| Flag | Default | Meaning |
| --- | --- | --- |
| `MODEL_FALLBACKS` | on | Honor `models[]` / registry chains |
| `USAGE_ASYNC` | on | Queue usage writes |
| `READY_CHECK_DB` | on | `/ready` hits Postgres |

---

## 16. Failure modes & resilience

| Failure | Behavior |
| --- | --- |
| Postgres down | Auth may fail if cache miss; readiness false; prefer fail closed for new keys |
| Redis down | **Fail open** with process-local low default RPM for V1 availability (document: not a supported multi-instance mode). Compose always runs Redis for supported deploys |
| Provider outage | Failover plan; 502 if exhausted |
| Partial stream then die | Close client stream; meter partial; log |
| Poison registry config | Skip inactive models; boot with last-good snapshot if available |
| Retry storm | Cap attempts; exponential backoff **only** when same endpoint retried |

Circuit-style optional: mark endpoint `unhealthy` in Redis for 30s after consecutive failures (OpenRouter-like “recent outage” preference, simplified).

---

## 17. V1 boundaries (scope control)

### 17.1 In scope

- Text chat completions stream + non-stream  
- Models list  
- API keys via CLI (create/list/revoke) — **no user accounts**  
- Registry with ≥ 2 providers (canonical `provider/model` ids)  
- Model fallbacks (primary) + multi-endpoint structure  
- Pre-commit stream failover only  
- Basic per-key RPM + max_tokens clamp (+ optional daily cap)  
- Usage ledger + cost estimate (one row per terminal request)  
- Docker Compose deploy  
- `/health` + `/ready`  
- Docs: quickstart with OpenAI SDK (TS required; Python nice)  

### 17.2 Explicitly out of scope

| Item | Phase |
| --- | --- |
| User signup / OAuth / sessions | 2 |
| Dashboard UI | 2 |
| Stripe / credits / prepaid balance | 2 |
| BYOK (customer provider keys) | 2 |
| Organizations / SSO | 2 |
| Semantic cache | 2 |
| Aliases / virtual models (`aihay/cheap`, …) | 2 |
| Tools / vision as productized features | 2+ |
| Mid-stream transparent failover | never (wrong contract) |
| Smart / auto routing | 3 |
| Embeddings / images APIs | 3 |
| 10+ provider adapters | later |
| Multi-region active-active | later |
| Go hot-path rewrite | only if metrics require |

### 17.3 Commercial architecture note

V1 metering is **billing-ready**, not billing-complete. Research on OpenRouter’s model (pass-through inference + platform fee, later BYOK) implies:

- Ship accurate usage first  
- Choose resell vs BYOK vs subscription after traffic exists  
- Do not block V1 API on payment integration  

---

## 18. Build phases mapped to architecture

| Phase | Architecture milestone | Exit criteria |
| --- | --- | --- |
| **0 — Spike** | Single process; 2 text adapters; non-stream; hard-coded key | Normalized response from both providers |
| **1a — Wire** | Hono routes; Zod; stream-through SSE; reject tools/vision | OpenAI SDK stream works against local server |
| **1b — Control plane** | Postgres CLI keys; registry YAML; usage; RPM + max_tokens floor | Metered multi-key auth |
| **1c — Reliability** | Attempt plan; model fallback; stream pre-commit only | Primary fail → fallback succeeds |
| **1d — Ship** | Docker Compose; `/health`+`/ready`; quickstart | Smoke green |
| **1e — Harden** | Tests, security, tag | **`v0.1.0`** |

---

## 19. Risks (architecture-level)

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Provider API drift | Broken adapters | Contract tests; pin API versions; thin adapters |
| Streaming bugs | Bad UX, memory spikes | E2E stream tests; no full buffer; load test concurrent streams |
| Sync DB on hot path | p99 latency | Cache keys; async usage |
| Scope creep (catalog) | Never ship | Hard cap 2–3 adapters until MVP metrics green |
| Cost estimate wrong | Billing distrust later | Store raw usage; version price table |
| Key material exposure | Security incident | Hash AI Hay keys; secret manager for provider keys |
| Competing on catalog size | Lose to OpenRouter | Compete on ownability, DX, transparent policy |

---

## 20. Engineering decisions

### 20.1 Locked

| # | Decision | Choice |
| --- | --- | --- |
| 1 | HTTP framework | **Hono** |
| 2 | Runtime | **Node 22+ LTS** |
| 3 | Key hashing | **HMAC-SHA256 + pepper** |
| 4 | Stream failover | **Pre-commit only** |
| 5 | Content V1 | **Text only** |
| 6 | Aliases | **Out of V1 DoD** |
| 7 | Identity | **CLI ApiKey**; no User |
| 8 | First tag | **`v0.1.0`** |

### 20.2 Flexible (pick at implement time)

| # | Decision | Recommendation | Revisit when |
| --- | --- | --- | --- |
| 1 | YAML-only vs DB registry | **YAML seed**; DB optional later | Multi-tenant custom models |
| 2 | Sync vs async usage | **Async enqueue** preferred | Volume near-zero (sync OK) |
| 3 | Redis | **Required in Compose**; fail-open local RPM if down | Multi-instance always needs Redis |
| 4 | ORM | Drizzle or Kysely | Team preference |
| 5 | Monorepo | Single `apps/api` until SDK/dashboard | Second package needed |

---

## 21. Documentation map

| Doc | Role vs this architecture |
| --- | --- |
| [Product Specification](./product-spec.md) | *What* and *why* |
| **This document** | *How* V1 is structured |
| [Architecture V2](./architecture-v2.md) | *How* productization / multi-tenant evolves after V1 |
| [Scalability](./scalability.md) | *How* we scale RPS, streams, regions |
| [Implementation Plan (V1)](./implementation-plan-v1.md) | *How* we execute (phases, tasks, DoD) |
| [How to Build](../how-to-build-ai-model-router.md) | Implementation sequence |
| [Router vs Gateway](../router-vs-gateway.md) | Concept split |
| [Language comparison](../language-technology-comparison.md) | Stack rationale |
| [TS performance](../typescript-performance-ai-router.md) | Latency budgets & anti-patterns |
| [OpenRouter overview](../openrouter-overview-2026.md) | Reference dual-layer routing |
| [Market brief](../ai-model-routers-2026.md) | Category landscape |
| [OpenRouter commercial model](../business/openrouter-cogs-commercial-model.md) | Future billing architecture |

---

## 22. Summary

**AI Hay Router V1** is a **stateless TypeScript gateway** with a **registry-driven router**:

1. Authenticate **CLI-issued** AI Hay keys (no user accounts)  
2. Resolve **canonical** model → ordered attempts (model fallback primary)  
3. Execute via **OpenAI + Anthropic text adapters**  
4. **Stream-through** SSE with **pre-commit** failover only  
5. **Meter** one usage row per terminal request; RPM + max_tokens spend floor  
6. Deploy as **Docker Compose** → tag **`v0.1.0`**

Ship this control plane before catalog scale, aliases, tools/vision, smart routing, or billing. Measurement and a clean OpenAI-compatible contract are the architecture’s north star.

---

*Architecture design V1 — living document. Update when the request pipeline, data model, or V1 boundaries change.*
