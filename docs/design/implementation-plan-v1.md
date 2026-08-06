# AI Hay Router — Implementation Plan (V1)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Implementation plan (V1) |
| **Status** | Ready to build (synced with Product Spec + Architecture) |
| **Last updated** | 2026-08-06 (layout section expanded) |
| **Based on** | [Product Spec](./product-spec.md) · [Architecture V1](./architecture-v1.md) |
| **Goal** | Ship a self-hostable OpenAI-compatible multi-model gateway with CLI keys, metering, model fallbacks, and docs |
| **First release tag** | `v0.1.0` |

This plan is the **engineering execution path** for V1. It turns architecture into ordered work, acceptance criteria, and a definition of done. It deliberately **excludes** account signup, dashboard, billing, BYOK, aliases, tools/vision DoD, mid-stream failover, and smart auto-routing.

---

## 1. Outcome (what “V1 done” means)

An operator / developer can:

1. `docker compose up` with provider env keys  
2. Mint an AI Hay API key via CLI (no user account / signup)  
3. Call **text** chat completions with the OpenAI SDK (`baseURL` + `AIHAY_API_KEY`)  
4. Stream tokens without full-body buffering  
5. Survive primary failure via **model fallback** (and multi-endpoint if configured), with **pre-commit-only** stream failover  
6. See usage (tokens, $ estimate, model, provider, latency) in the ledger — **one row per terminal request**  

**Success metrics (from product spec):**

| Metric | Target |
| --- | --- |
| Time to first successful call | &lt; 10 minutes with docs |
| Gateway overhead p50 (warm, same region) | ≤ 15 ms (excluding provider) |
| Streaming | First token not blocked by full-body buffer |
| Reliability | Model fallback / retries on 5xx / timeout (pre-commit for stream) |
| Metering | Usage row for every terminal request |
| Providers | ≥ 2 production adapters (OpenAI + Anthropic) |
| Content | Text only; tools/vision rejected with 400 |

---

## 2. Scope lock

### 2.1 In scope (build this)

| Area | Deliverable |
| --- | --- |
| API | `POST /v1/chat/completions` (stream + non-stream, **text**) |
| API | `GET /v1/models` |
| API | `GET /health`, `GET /ready` |
| Auth | Bearer `sk-aihay-…`; **HMAC-SHA256 + pepper**; CLI mint/list/revoke |
| Limits | Per-key RPM; default/clamp `max_tokens`; optional daily token/$ soft cap |
| Registry | YAML: canonical `provider/model` → upstream + pricing + fallbacks |
| Adapters | OpenAI, Anthropic (text) |
| Router | Attempt plan: endpoints + **model fallbacks**; stream **pre-commit only** |
| Metering | One `usage_events` row per terminal request + cost estimate |
| Deploy | Docker Compose (api + Postgres + Redis) |
| DX | Quickstart (curl + **TS** OpenAI SDK required; Python nice); env example |
| Tests | Unit + adapter contract + stream E2E smoke + fallback chaos |

### 2.2 Out of scope (do not build in V1)

| Item | Why deferred |
| --- | --- |
| User signup / login / OAuth / sessions | Self-host V1; keys via CLI |
| Dashboard UI | Phase 2 |
| Stripe / credits / prepaid balance | Meter first |
| BYOK (customer provider keys) | Phase 2 |
| Orgs, invites, RBAC, SSO | Phase 2 |
| Aliases (`aihay/cheap`, …) | Phase 2 |
| Tools / vision as DoD | Reject with 400; OpenAI tools only as approved stretch |
| Mid-stream model/provider switch | Wrong OpenAI stream contract |
| Smart / auto model routing | Phase 3; needs evals |
| Semantic cache | Phase 2 |
| Embeddings / images APIs | Phase 3 |
| 3rd+ providers | After MVP green |
| Multi-region HA | After single-region stable |

### 2.3 Decisions locked for this plan

| Decision | Choice |
| --- | --- |
| Account management | **No** for V1 |
| How keys are created | **CLI / admin script** against Postgres |
| Runtime identity | `api_keys` + single default `workspace` |
| Provider credentials | Platform env (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) |
| Key hash | **HMAC-SHA256 + pepper** |
| Framework | **Hono** + Node 22+ |
| Content | **Text chat only** for DoD |
| Failover | Pre-commit for stream; **model fallback** is primary demo |
| Release tag | **`v0.1.0`** |

---

## 3. Recommended stack (locked)

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| Runtime | Node 22+ LTS |
| HTTP | Hono |
| Validation | Zod |
| DB | Postgres + Drizzle (or Kysely) |
| Cache / limits | Redis |
| HTTP client | `fetch` (undici) |
| Tests | Vitest |
| Package manager | pnpm |
| Deploy | Docker + Compose |

---

## 4. Repo / project layout

### 4.1 Mental model

The repository is a **pnpm monorepo** with one shippable app today (`apps/api`) plus design/ops docs at the root. Runtime code lives under `apps/api`; research and product design live under `docs/`.

```text
Request path (rough):

  server.ts → app.ts → middleware (auth) → routes/chat-completions
      → pipeline/handle-chat → providers/* → upstream
      → metering/usage (async)
```

| Layer | Responsibility |
| --- | --- |
| **Root** | Workspace tooling, Compose, env examples, smoke scripts, README |
| **`apps/api`** | The gateway process: HTTP, routing, adapters, keys, usage |
| **`docs/`** | Product/architecture/implementation + runbook (not imported by runtime) |

There is **no** separate `packages/cli` package yet: CLI entrypoints are scripts under `apps/api/src/scripts/` exposed via `pnpm keys`, `pnpm smoke`, etc.

### 4.2 Tree (as implemented)

```text
ai-hay-router/
├── package.json                 # workspace root scripts (dev, test, keys, smoke…)
├── pnpm-workspace.yaml          # packages: apps/*
├── pnpm-lock.yaml
├── .npmrc                       # pnpm install policy (Docker/CI friendly)
├── .nvmrc                       # Node 22+
├── .env.example                 # documented env vars (committed)
├── .env                         # local secrets (gitignored)
├── .dockerignore
├── docker-compose.yml           # api + postgres + redis
├── sample_test.sh               # curl smoke vs local/Compose API
├── README.md
│
├── docs/
│   ├── runbook.md               # operate / debug / incidents
│   └── design/
│       ├── product-spec.md
│       ├── architecture-v1.md
│       └── implementation-plan-v1.md   # this file
│   └── … research notes (market, OpenRouter, COGS, etc.)
│
└── apps/api/                    # @aihay/api — the product binary
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── Dockerfile               # multi-stage production image
    ├── models.yaml              # model registry seed
    └── src/
        ├── server.ts            # process entry: boot, listen, shutdown
        ├── bootstrap.ts         # stores (memory|postgres), redis limiter
        ├── app.ts               # Hono app wiring
        ├── config.ts            # env via Zod
        ├── types/chat.ts        # OpenAI-shaped request/response types
        │
        ├── middleware/
        │   ├── request-id.ts
        │   ├── auth.ts          # Bearer dev key or hashed sk-aihay-…
        │   └── error-handler.ts
        │
        ├── routes/
        │   ├── health.ts        # /health, /ready
        │   ├── models.ts        # GET /v1/models
        │   ├── chat-completions.ts
        │   └── schemas.ts       # Zod + V1 content policy (no tools/vision)
        │
        ├── pipeline/
        │   ├── handle-chat.ts   # attempt loop, stream commit
        │   ├── attempt-plan.ts  # model/endpoint order + fallbacks
        │   └── execute-attempt.ts
        │
        ├── registry/
        │   ├── types.ts
        │   ├── load.ts          # parse models.yaml
        │   └── resolve.ts
        │
        ├── providers/
        │   ├── types.ts         # ChatAdapter interface
        │   ├── stream/sse.ts
        │   ├── openai/
        │   ├── anthropic/
        │   ├── xai/             # Grok (OpenAI-compatible)
        │   └── ADAPTER_NOTES.md
        │
        ├── metering/
        │   ├── cost.ts
        │   └── usage.ts         # enqueue usage_events
        │
        ├── db/
        │   ├── types.ts         # KeyStore / UsageStore interfaces
        │   ├── schema.sql
        │   ├── memory-store.ts  # local dev without Postgres
        │   └── pg-store.ts      # durable keys + usage
        │
        ├── lib/
        │   ├── hash.ts          # HMAC API keys
        │   ├── rate-limit.ts    # memory or Redis RPM/daily
        │   ├── logger.ts
        │   └── errors.ts        # OpenAI-like AppError
        │
        └── scripts/
            ├── spike-chat.ts    # Phase 0: direct provider call
            ├── keys.ts          # keys create|list|revoke
            ├── migrate.ts
            └── smoke.ts
```

Tests sit next to code as `**/__tests__/*.test.ts` and `app.integration.test.ts`.

### 4.3 Directory guide

| Path | What it is | When you touch it |
| --- | --- | --- |
| **`apps/api/src/server.ts`** | Process bootstrap | Port, graceful shutdown, boot logging |
| **`bootstrap.ts`** | Choose memory vs Postgres; Redis vs in-process limits | New store drivers, migrate-on-boot |
| **`app.ts`** | Mount middleware + routes | New public routes |
| **`config.ts`** | Env schema defaults | New env vars |
| **`middleware/`** | Cross-cutting HTTP | Auth, request ids, error JSON |
| **`routes/`** | HTTP handlers + Zod | API contract, streaming SSE |
| **`pipeline/`** | Routing / failover orchestration | Attempt plan, timeouts, stream commit rules |
| **`providers/`** | Vendor adapters only | New lab (e.g. Gemini): add folder + registry rows |
| **`registry/` + `models.yaml`** | Model id → provider, pricing, endpoints | Add/remove models, fallbacks, prices |
| **`metering/`** | Cost estimate + usage enqueue | Billing-ready fields |
| **`db/`** | Key + usage persistence | Schema, Postgres vs memory |
| **`lib/`** | Shared pure helpers | Hash, rate limit, logger |
| **`scripts/`** | Operator CLIs | keys, migrate, smoke, spike |
| **`docker-compose.yml`** | Full stack | Ports, env interpolation from root `.env` |
| **`docs/design/`** | Specs | Product/architecture/plan — not runtime |
| **`docs/runbook.md`** | Ops procedures | Deploy, incidents, troubleshooting |
| **`sample_test.sh`** | Manual curl smoke | Durable/dev key against running API |

### 4.4 Workspace & scripts

Root `package.json` forwards into `@aihay/api`:

| Command | Effect |
| --- | --- |
| `pnpm dev` | `tsx watch src/server.ts` (hot reload) |
| `pnpm build` / `pnpm start` | `tsc` → `node dist/server.js` |
| `pnpm test` / `pnpm typecheck` | Vitest / `tsc --noEmit` |
| `pnpm keys …` | Durable/memory key CLI |
| `pnpm migrate` | Apply `schema.sql` (needs `DATABASE_URL`) |
| `pnpm smoke` | HTTP smoke against running server |
| `pnpm spike:chat` | Direct provider adapter test (no gateway) |

Package name: **`@aihay/api`**. Workspace definition: `pnpm-workspace.yaml` → `apps/*`.

### 4.5 Runtime artifacts (not source of truth)

| Path | Notes |
| --- | --- |
| `node_modules/` | gitignored; `pnpm install` |
| `apps/api/dist/` | Build output (`tsc` + copied `schema.sql` / `models.yaml`) |
| `.env` | Local secrets; gitignored — Compose also reads it for `${VAR}` interpolation |

### 4.6 Design rules for layout

1. **Adapters stay thin** — vendor quirks only in `providers/*`; pipeline stays provider-agnostic.  
2. **OpenAI wire types** live in `types/chat.ts`; adapters normalize to them.  
3. **Stores behind interfaces** (`KeyStore`, `UsageStore`) so memory and Postgres share one app path.  
4. **Docs are not imported** by the API — safe to edit without rebuilds.  
5. **New providers** = new `providers/<id>/` + rows in `models.yaml` + `adapterFor` / `credentialFor` wiring + unit tests.  
6. **Future packages** (official SDK, dashboard) can add `apps/web` or `packages/sdk` without moving the gateway.

### 4.7 Request → file map

| Concern | Primary files |
| --- | --- |
| Accept HTTP | `server.ts`, `app.ts`, `routes/*` |
| Auth + RPM | `middleware/auth.ts`, `lib/hash.ts`, `lib/rate-limit.ts`, `db/*` |
| Validate body | `routes/schemas.ts` |
| Pick model/endpoint | `registry/*`, `pipeline/attempt-plan.ts` |
| Call upstream | `pipeline/execute-attempt.ts`, `providers/*` |
| Stream SSE | `routes/chat-completions.ts`, `providers/stream/sse.ts` |
| Meter | `metering/*`, `db/*` |
| Operator keys | `scripts/keys.ts` |

---

## 5. Phased plan

Work is ordered so each phase is **demoable**. Do not start Phase 1b before 1a streaming works.

| Phase | Name | Calendar (1 eng, rough) | Depends on |
| --- | --- | --- | --- |
| **0** | Spike | 1–3 days | — |
| **1a** | Wire API + streaming | 3–5 days | 0 |
| **1b** | Control plane (keys, registry, usage) | 3–5 days | 1a |
| **1c** | Reliability (failover, timeouts) | 2–4 days | 1b |
| **1d** | Ship (Docker, CLI polish, docs, smoke) | 2–3 days | 1c |
| **1e** | Hardening (tests, perf checks, polish) | 2–3 days | 1d |

**Total directional estimate:** ~2–4 weeks for one full-time engineer to a shippable MVP (provider API access available).

---

### Phase 0 — Spike (prove adapters)

**Goal:** Prove OpenAI-shaped request → two providers → normalized response. No production auth, no stream yet.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 0.1 | Init TS project (pnpm, strict, Vitest, tsx) | ESLint optional |
| 0.2 | Define shared types: messages, chat request/response | Align with OpenAI shapes |
| 0.3 | Implement OpenAI adapter (non-stream only) | `fetch` to Chat Completions |
| 0.4 | Implement Anthropic adapter (non-stream only) | Message/system translation |
| 0.5 | Hard-coded single route or script: call both | Env: provider keys |
| 0.6 | Document adapter quirks discovered | Tools/system/usage fields |

#### Acceptance criteria

- [ ] Script/route returns OpenAI-like JSON from **OpenAI** for a hello prompt  
- [ ] Same for **Anthropic** after normalization  
- [ ] Token usage present or estimated with a flag  
- [ ] No dashboard, no DB required  

#### Exit demo

```bash
pnpm spike:chat --provider openai --model gpt-4o-mini
pnpm spike:chat --provider anthropic --model claude-3-5-haiku-latest
```

---

### Phase 1a — Wire API + streaming

**Goal:** Real HTTP API; OpenAI SDK works for stream and non-stream against a temporary auth stub.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1a.1 | Hono app: mount routes, CORS minimal, JSON errors | |
| 1a.2 | `request_id` middleware + `x-request-id` header | UUID |
| 1a.3 | Zod validate `POST /v1/chat/completions` body | model, messages, stream, … |
| 1a.4 | Reject tools / vision / image parts with 400 | Content policy |
| 1a.5 | Auth stub: accept fixed env `AIHAY_DEV_KEY` or any `sk-` in dev | Replace in 1b |
| 1a.6 | Stream-through SSE for OpenAI adapter | **No** full buffer |
| 1a.7 | Stream-through SSE for Anthropic → OpenAI chunk shape | Map events |
| 1a.8 | Client abort → `AbortSignal` to upstream | |
| 1a.9 | `GET /v1/models` from in-memory/YAML list | Canonical ids only |
| 1a.10 | `GET /health` | 200 ok |
| 1a.11 | Error normalizer (400/401/429/502 OpenAI-like) | |
| 1a.12 | Manual test with official `openai` npm package | stream true/false |

#### Acceptance criteria

- [ ] Non-stream **text** chat works for both providers via canonical model ids  
- [ ] Stream: client receives first chunk without waiting for full completion  
- [ ] OpenAI Node SDK drop-in works with `baseURL`  
- [ ] Disconnect mid-stream cancels upstream (verified in logs/tests)  
- [ ] Unknown model / bad body / tools / vision return structured error  

#### Exit demo

```ts
const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_DEV_KEY,
});
const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
  stream: true,
});
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
```

---

### Phase 1b — Control plane (keys, registry, usage)

**Goal:** Multi-key auth, durable registry, usage ledger. Still no user accounts.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1b.1 | Postgres schema: `workspaces`, `api_keys`, `usage_events` | Migrations via Drizzle |
| 1b.2 | Seed default workspace on migrate | Single-tenant V1 |
| 1b.3 | Key hashing: **HMAC-SHA256 + `AIHAY_KEY_PEPPER`** | Secret shown once |
| 1b.4 | CLI: `keys create --name` / `list` / `revoke` | Prints `sk-aihay-…` once |
| 1b.5 | Auth middleware: Bearer → hash → lookup; Redis cache TTL | Revoke invalidates |
| 1b.6 | Replace dev-key stub with real key verification | Keep override only in test |
| 1b.7 | Registry loader: `models.yaml` → resolve(model) | Pricing + endpoints + fallbacks |
| 1b.8 | Cost estimator from registry prices | |
| 1b.9 | Usage write path (async enqueue preferred) | One row per terminal request; never block first stream byte |
| 1b.10 | Basic per-key RPM via Redis | Fail open with low default if Redis down (document) |
| 1b.11 | Spend floor: default/clamp `max_tokens` | Config-driven |
| 1b.12 | Optional per-key daily token or $ soft cap | Redis counters |
| 1b.13 | Response headers: `x-aihay-model`, `x-aihay-provider` | |

#### Acceptance criteria

- [ ] Created key works; revoked key returns 401  
- [ ] Second key isolates usage rows by `api_key_id`  
- [ ] Every successful/failed terminal chat produces **one** `usage_events` row  
- [ ] Cost estimate populated when prices exist  
- [ ] RPM and max_tokens clamp enforced  
- [ ] No email/password/signup code in the tree  

#### Data model minimum (implement as designed)

- `workspaces` — one default  
- `api_keys` — hash, prefix, name, rpm, revoked_at  
- `usage_events` — request_id, key, models, provider, tokens, cost, latency, status  

#### CLI UX (V1 onboarding)

```bash
# After compose up + migrate
pnpm aihay keys create --name local-dev
# sk-aihay-...  (copy now; not shown again)

pnpm aihay keys list
pnpm aihay keys revoke --prefix sk-aihay-abcd
```

---

### Phase 1c — Reliability (failover & timeouts)

**Goal:** Request survives primary failure when **model fallback** (or multi-endpoint) is configured. Stream failover is **pre-commit only**.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1c.1 | `attempt-plan` builder from registry + optional `models[]` | Bounded max attempts (default 3, hard 5) |
| 1c.2 | Per-attempt timeout + global request deadline | Config env |
| 1c.3 | Classify errors: retriable vs fatal | 429/5xx/timeout vs 400/401 |
| 1c.4 | Multi-endpoint structure (same model, next endpoint) | Ready even if only one endpoint configured |
| 1c.5 | **Model fallback chain** (primary demo path) | Registry `fallback_models` and/or request `models[]` |
| 1c.6 | **Stream commit guard** | No further attempts after first client SSE byte |
| 1c.7 | Mid-stream upstream death → terminal error + partial meter | No silent model switch |
| 1c.8 | Optional attempt trace (no prompts) | Log or `request_traces` |
| 1c.9 | Optional circuit: mark endpoint unhealthy in Redis ~30s | Nice-to-have |
| 1c.10 | Chaos test: mock primary 503 → **fallback model** succeeds | Automated; model fallback, not multi-host same model |

#### Acceptance criteria

- [ ] Non-stream: primary forced fail → fallback model returns 200  
- [ ] Stream: failover only before commit; after commit no model switch  
- [ ] Usage shows **actual** model/provider used + `attempt_count`  
- [ ] Exhausted attempts → 502 `upstream_unavailable`  
- [ ] No infinite retry loops  

---

### Phase 1d — Ship (Docker, docs, smoke)

**Goal:** Someone else can run V1 from clean machine using docs only.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1d.1 | `Dockerfile` multi-stage for api | Non-root user |
| 1d.2 | `docker-compose.yml`: api, postgres, redis | Healthchecks |
| 1d.3 | `.env.example` with all required vars | No real secrets |
| 1d.4 | Migrate on startup or documented migrate step | Prefer explicit migrate job |
| 1d.5 | `/ready` checks Postgres (and Redis if required) | |
| 1d.6 | Root README quickstart: compose → keys create → SDK snippet | &lt; 10 min path |
| 1d.7 | Document model IDs, errors, fallbacks, privacy, V1 limits | Text-only; no accounts; link design docs |
| 1d.8 | Smoke script: health + non-stream + stream | CI-friendly |
| 1d.9 | Pin Node version (`.nvmrc` / engines) | |
| 1d.10 | Optional Python OpenAI SDK snippet in docs | Nice-to-have |

#### Acceptance criteria

- [ ] Clean checkout + compose + key create + one text chat = success  
- [ ] Smoke script exits 0 against local stack  
- [ ] Quickstart uses `AIHAY_API_KEY` (brand-aligned)  
- [ ] Known limitations documented (no signup, no billing, text-only, 2 providers)  

---

### Phase 1e — Hardening

**Goal:** Confidence to put real traffic on self-host deploy.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1e.1 | Adapter contract tests (fixtures for stream events) | No live keys required for unit tests |
| 1e.2 | Integration tests with recorded/mock upstream | |
| 1e.3 | Live optional tests gated by env keys | Nightly or manual |
| 1e.4 | Structured JSON logging audit (no secrets/prompts) | |
| 1e.5 | Rough latency check: gateway overhead budget | Log timings; no full load suite required |
| 1e.6 | Capability gates enforced in tests (tools/vision → 400) | |
| 1e.7 | Security pass: SSRF (no client base_url), key never logged, spend floor present | |
| 1e.8 | Changelog + tag **`v0.1.0`** | Not `v1.0.0` |

#### Acceptance criteria

- [ ] CI green on unit + mock integration  
- [ ] Checklist in §8 all checked  
- [ ] Known limitations documented (no signup, no billing, text-only, 2 providers)  
- [ ] Tagged `v0.1.0`  

---

## 6. Work breakdown by component

| Component | Primary phases | Key files |
| --- | --- | --- |
| HTTP edge | 1a, 1d | `app.ts`, `routes/*`, `middleware/*` |
| Adapters | 0, 1a, 1e | `providers/openai`, `providers/anthropic` |
| Pipeline | 1a, 1c | `pipeline/*` |
| Registry | 1b | `registry/*`, `models.yaml` |
| Auth / keys | 1b | `middleware/auth.ts`, `db/keys.ts`, CLI |
| Metering | 1b | `metering/*`, `db/usage.ts` |
| Rate limit | 1b | `middleware/rate-limit.ts` |
| Deploy | 1d | `Dockerfile`, `docker-compose.yml` |
| Docs | 1d | root `README.md`, env example |

---

## 7. Testing strategy (from the beginning)

**Decision (locked):** unit tests start in **Phase 0** and grow with every phase. Do not defer testing to “after MVP.” A multi-provider gateway fails most often in **transforms and policy**, which are cheap to unit-test and expensive to debug in production.

### 7.1 Why unit tests from day one

| Area | Risk without tests | Unit-test value |
| --- | --- | --- |
| **Adapters** | Provider drift, SSE mapping, system-message bugs | Fixture-based parse/build without live keys |
| **Validation / content policy** | Tools/vision leak into V1 | Enforce 400 paths in CI |
| **Attempt plan** | Wrong fallback order, unbounded retries | Deterministic plan builder tests |
| **Auth / metering (1b+)** | Key hash mistakes, cost math errors | Safe hot-path refactors |
| **Stream commit / failover** | Mid-stream “retry” bugs | Guard rules and chaos with mocks |

This product is mostly **I/O + pure transforms**. Prefer unit tests for transforms; reserve live provider calls for optional smoke.

### 7.2 Test pyramid (V1)

| Layer | Required for merge? | What | When |
| --- | --- | --- |
| **Unit** | **Yes** | Zod, attempt-plan, cost, key hash, error classify, adapter fixtures (JSON/SSE) | Phase **0** onward |
| **Integration (mock upstream)** | Yes once routes stabilize | Hono app + mocked `fetch` / upstream; no live keys | Phase **1b+** |
| **Smoke script** | Yes for ship | `/health`, one non-stream, one stream (local stack) | Phase **1d** |
| **Live provider E2E** | **No** (optional) | Real OpenAI/Anthropic; env-gated, manual or nightly | Phase **1d+** |
| **Manual** | Phase exits | OpenAI SDK stream, abort, fallback chaos | Each phase demo |

**Do not block V1 on:** full coverage %, browser e2e, load tests, or mandatory live CI.

### 7.3 Rules of thumb (PR review)

For each new module:

1. **Pure logic** (plan, hash, cost, SSE parse, Zod) → **unit tests required** before merge.  
2. **HTTP handler / pipeline** → at least one happy path + one error with **mock** upstream.  
3. **Live provider** → optional; never the only proof.  
4. **No** `await response.text()` full-buffer on stream path — add/adjust tests when touching stream code.  
5. New **adapter** → non-stream fixture + stream fixture + `classifyError` cases (see adapter test matrix in Architecture).

### 7.4 What to cover by phase

| Phase | Minimum tests to add |
| --- | --- |
| **0** | Adapter buildRequest / parseResponse; Anthropic system split; error classify |
| **1a** | Stream parse fixtures; validateAndNormalize (tools/vision reject); health/models if cheap |
| **1b** | Key hash verify; cost estimate; usage row shape; auth middleware (valid/invalid/revoked) |
| **1c** | Attempt plan + max attempts; model fallback order; stream pre-commit (no switch after first byte) with mocks |
| **1d** | Smoke script (scripted curl or small Node client) against Compose |
| **1e** | CI green; fill gaps; no live network in default `pnpm test` |

### 7.5 Current baseline (as of first code drop)

Already in repo under `apps/api`:

- OpenAI / Anthropic adapter unit tests  
- Anthropic stream → OpenAI chunk fixture  
- Attempt-plan tests  
- Chat schema / content-policy tests  
- Registry YAML load tests  

**Command:** `pnpm test` (no network). **Typecheck:** `pnpm typecheck`.

Expand this suite as Phase 1b+ lands; do not reset or skip when adding features.

### 7.6 Minimum CI for V1 merge to main

1. `pnpm typecheck`  
2. `pnpm test` (unit + mock integration only; **no live network**)  
3. Lint (if/when configured)  

Optional job (not required for merge): live smoke when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` secrets exist.

### 7.7 Explicit non-goals for V1 testing

| Non-goal | Rationale |
| --- | --- |
| 100% line coverage gate | Diminishing returns; prefer critical-path tests |
| Mandatory live CI on every PR | Flaky, costly, needs secrets |
| Dashboard / UI e2e | No UI in V1 |
| Full multi-region / load suite | Out of V1 scope |

---

## 8. Definition of Done (V1 checklist)

### Product

- [ ] Text chat completions non-stream  
- [ ] Text chat completions stream (SSE, stream-through)  
- [ ] `GET /v1/models` (canonical ids)  
- [ ] `GET /health` + `GET /ready`  
- [ ] API keys via CLI (create/list/revoke) — **no account system**  
- [ ] Usage ledger with cost estimate (one row per terminal request)  
- [ ] OpenAI + Anthropic text adapters  
- [ ] Model fallbacks working; stream failover pre-commit only  
- [ ] Basic RPM + max_tokens spend floor  
- [ ] Docker Compose deploy  
- [ ] Quickstart docs &lt; 10 minutes  
- [ ] Tag **`v0.1.0`**  

### Engineering

- [ ] Typed pipeline + Zod validation  
- [ ] Keys hashed with HMAC-SHA256 + pepper  
- [ ] No prompt/completion storage by default  
- [ ] `request_id` on all responses  
- [ ] Bounded retries; no mid-stream model switch  
- [ ] Tools/vision rejected with 400  
- [ ] **Unit tests from Phase 0** maintained and extended per §7 (adapters, plan, policy, auth/metering as added)  
- [ ] Automated tests for adapters + attempt plan + fallback chaos (mock)  
- [ ] Smoke script  
- [ ] CI: `pnpm typecheck` + `pnpm test` (no live network)  

### Explicitly not done (and documented as such)

- [ ] No signup / user accounts  
- [ ] No dashboard  
- [ ] No billing  
- [ ] No BYOK  
- [ ] No aliases / virtual models  
- [ ] No tools/vision productization  
- [ ] No smart auto routing  

---

## 9. Week-by-week sketch (single engineer)

| Week | Focus | Demo at end of week |
| --- | --- | --- |
| **Week 1** | Phase 0 + 1a | OpenAI SDK streams from local Hono via both providers |
| **Week 2** | Phase 1b + start 1c | Real keys + usage rows; start failover |
| **Week 3** | Phase 1c + 1d | Compose up; chaos failover; public quickstart |
| **Week 4** | Phase 1e + buffer | CI green; polish; tag **`v0.1.0`** |

Compress to ~2 weeks if adapters are simpler and one engineer stays focused; expand if streaming edge cases dominate.

---

## 10. Risks & mitigations (execution)

| Risk | Mitigation in this plan |
| --- | --- |
| Anthropic stream mapping eats time | Spike mapping in Phase 0/1a; fixture tests early |
| Scope creep (signup, dashboard, tools) | §2.2 out of scope; reject in review |
| Mid-stream “failover” bugs | Stream commit guard in 1c; tests |
| Platform key spend runaway | RPM + max_tokens clamp + optional daily cap |
| Sync DB on hot path | Auth cache in Redis; async usage writes |
| Provider cost during dev | Cheap models in smoke only |
| “Just one more provider” | Hard stop at 2 until DoD met |
| Buffering bugs | Code review: no `response.text()` on stream path |

---

## 11. Dependencies & prerequisites

| Prerequisite | Owner |
| --- | --- |
| OpenAI API key for platform testing | Eng |
| Anthropic API key for platform testing | Eng |
| Docker + Node 22 on dev machines | Eng |
| Decisions locked: Hono, no signup in V1, CLI keys | Product/Eng (this plan) |

Still open product questions (do **not** block V1 implementation):

- Managed cloud vs OSS-first packaging  
- Long-term license  
- Public hostname / brand domain  
- Billing model after metering exists  

---

## 12. Suggested first PR sequence

Ship as small PRs, not one mega-merge:

| PR | Content |
| --- | --- |
| PR1 | Repo scaffold, tooling, empty Hono server, health |
| PR2 | Shared types + OpenAI non-stream adapter + spike |
| PR3 | Anthropic non-stream adapter |
| PR4 | Chat route non-stream + Zod + error shape |
| PR5 | Streaming both adapters + abort |
| PR6 | Postgres schema + keys CLI + auth middleware |
| PR7 | Registry YAML + models route + cost + usage |
| PR8 | Attempt plan + model fallback + stream commit guard + tests |
| PR9 | Docker Compose + quickstart README + smoke |
| PR10 | Hardening, spend floor polish, CI, tag **`v0.1.0`** |

---

## 13. Post-V1 (not scheduled here)

After V1 DoD:

| Next | Trigger |
| --- | --- |
| Budget / spend policy UI | Abuse or multi-dev self-host |
| Third provider (Gemini or Groq) | Customer ask or cost strategy |
| Aliases (`aihay/cheap`) | Registry policy only |
| Tools / vision productization | Customer demand after text path stable |
| Dashboard + signup | Decision to run multi-tenant managed cloud |
| BYOK + billing | Monetization decision |
| Smart routing | Enough traffic + eval harness |

---

## 14. Documentation map

| Doc | Role |
| --- | --- |
| [Product Specification](./product-spec.md) | What / why |
| [Architecture Design (V1)](./architecture-v1.md) | System structure |
| [Architecture Design (V2)](./architecture-v2.md) | Productization target |
| **This plan** | How we execute V1 |
| [Implementation Plan (V2)](./implementation-plan-v2.md) | How we execute V2 |
| [How to Build](../how-to-build-ai-model-router.md) | General builder guide |
| Research under `docs/` | Market context |

---

## 15. Summary

**V1 implementation = gateway core first:**

1. Text adapters (OpenAI + Anthropic)  
2. Stream-through OpenAI-compatible API  
3. CLI-issued API keys (no accounts)  
4. Registry + usage metering + spend floor  
5. Model fallback (pre-commit stream failover only)  
6. Docker + quickstart → tag **`v0.1.0`**  
7. **Unit tests from Phase 0** (§7); mock integration; optional live smoke  

Do not block V1 on user management, billing, aliases, tools/vision, or smart routing. Measure everything; productize accounts only when multi-tenant self-serve is the distribution model.

---

*Implementation plan V1 — living document. Update checkboxes and estimates as phases complete.*
