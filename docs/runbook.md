# AI Hay Router — Runbook (V1)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Audience** | Operators and engineers running the gateway |
| **Last updated** | 2026-08-06 |
| **Related** | [Architecture](./design/architecture-v1.md) · [Implementation plan](./design/implementation-plan-v1.md) · [README](../README.md) |

Operational guide: how to **start**, **configure**, **issue keys**, **verify health**, **debug failures**, and **recover**. Not a product design doc.

---

## 1. System overview

```text
Client (OpenAI SDK / curl)
        │  Bearer sk-aihay-…  or  AIHAY_DEV_KEY
        ▼
┌───────────────────────────────────────┐
│  AI Hay API (Hono / Node 22)          │
│  auth · RPM · validate · route        │
│  adapters · stream · usage enqueue    │
└───────────┬─────────────┬─────────────┘
            │             │
     Postgres/Redis    OpenAI · Anthropic · xAI
     (optional)        (platform keys in env)
```

| Mode | When to use |
| --- | --- |
| **Memory** | Local dev; keys/usage in-process (lost on restart) |
| **Postgres + Redis** | Durable keys/usage + distributed RPM (Compose / prod-like) |

---

## 2. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js **22+** | See `.nvmrc` |
| **pnpm** | Package manager |
| Docker (optional) | Compose stack: api + Postgres + Redis |
| Provider keys (for live chat) | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY` |

```bash
node -v    # >= 22
pnpm -v
```

---

## 3. Configuration reference

Copy and edit:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `AIHAY_DEV_KEY` | `sk-aihay-dev-local` | Fixed Bearer key for local/dev (always accepted if matched) |
| `AIHAY_KEY_PEPPER` | `dev-pepper-change-me` | HMAC pepper for hashing CLI-issued keys — **change in any shared env** |
| `STORE_DRIVER` | `auto` | `auto` \| `memory` \| `postgres` (`auto` → postgres if `DATABASE_URL` set) |
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | — | Redis for RPM/daily counters; falls back to in-process limiter |
| `OPENAI_API_KEY` | — | Platform key for OpenAI models |
| `ANTHROPIC_API_KEY` | — | Platform key for Claude models |
| `XAI_API_KEY` | — | Platform key for Grok models |
| `REQUEST_TIMEOUT_MS` | `120000` | Per-attempt upstream timeout |
| `DEFAULT_MAX_TOKENS` | `4096` | Default and **clamp** for `max_tokens` |
| `DEFAULT_RPM` | `60` | Per-key requests/minute if key has no override |
| `MAX_ATTEMPTS` | `3` | Max failover/fallback attempts |

**Security notes**

- Never commit `.env`.
- Rotate `AIHAY_KEY_PEPPER` only with a full key re-issue (hashes become invalid).
- Provider keys spend **your** money; keep RPM and token caps on.
- Do not expose `AIHAY_DEV_KEY` on a public internet deployment.

---

## 4. Local run (memory mode)

Fastest path; no Postgres/Redis required.

```bash
pnpm install
cp .env.example .env
# Optional: set OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY

pnpm test          # unit + integration (no live network)
pnpm dev           # http://localhost:3000
```

**Verify**

```bash
curl -s http://localhost:3000/health
# {"status":"ok"}

curl -s http://localhost:3000/ready
# {"status":"ready"}

curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-aihay-dev-local"
```

**Chat (needs provider key)**

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-aihay-dev-local" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role":"user","content":"hi"}],
    "stream": false
  }'
```

**Client (OpenAI SDK)**

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_API_KEY ?? "sk-aihay-dev-local",
});
```

---

## 5. Docker Compose (Postgres + Redis)

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export XAI_API_KEY=xai-...
export AIHAY_KEY_PEPPER=strong-random-value

docker compose up --build
# API :3000  Postgres :5432  Redis :6379
```

**Create a durable API key** (CLI talks to the same DB as Compose):

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay \
STORE_DRIVER=postgres \
AIHAY_KEY_PEPPER=strong-random-value \
pnpm keys create --name compose-dev
# Copy sk-aihay-… once; only the hash is stored
```

**Migrate only** (API also migrates on boot when using Postgres):

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay pnpm migrate
```

**Stop**

```bash
docker compose down
# data volume: docker compose down -v   # destructive
```

---

## 6. API key management

| Command | Action |
| --- | --- |
| `pnpm keys create --name <label>` | Mint key; prints secret **once** |
| `pnpm keys list` | List prefix, name, revoked flag |
| `pnpm keys revoke --prefix sk-aihay-xxxx` | Soft-revoke matching keys |

**Auth behavior**

1. `Authorization: Bearer <token>`
2. If token equals `AIHAY_DEV_KEY` → accept (dev identity)
3. Else if `sk-aihay-…` → HMAC-SHA256(token, pepper) → lookup `api_keys`
4. Revoked / unknown → `401`
5. Over RPM / daily token limit → `429`

Memory-mode keys exist only in that process; use Postgres for anything you care about after restart.

---

## 7. Models and providers

Registry seed: `apps/api/models.yaml`.

| AI Hay model id | Provider | Env credential |
| --- | --- | --- |
| `openai/gpt-4o-mini`, `openai/gpt-4o` | OpenAI | `OPENAI_API_KEY` |
| `anthropic/claude-3-5-haiku-latest`, `anthropic/claude-sonnet-4-0` | Anthropic | `ANTHROPIC_API_KEY` |
| `xai/grok-4.5`, `xai/grok-3`, `xai/grok-3-mini` | xAI Grok | `XAI_API_KEY` |

List active models:

```bash
curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer $AIHAY_API_KEY"
```

**V1 limits:** text chat only. Tools / vision → `400` `unsupported_parameter`.

**Fallback (optional):** request body `models: ["xai/grok-3-mini"]` or `fallback_models` in YAML. Stream failover only **before** first client SSE byte.

---

## 8. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Liveness |
| `GET` | `/ready` | No | Readiness (DB ping if Postgres) |
| `GET` | `/metrics` | No | Prometheus text (V2.0; disable with `FEATURE_METRICS=false`) |
| `GET` | `/v1/models` | Yes | Model list |
| `POST` | `/v1/chat/completions` | Yes | Chat (stream / non-stream) |

Useful response headers: `x-request-id`, `x-aihay-model`, `x-aihay-provider`.

**Network note:** Protect `/metrics` at the edge (not public internet) in production.

---

## 9. Day-2 operations

### 9.1 Health checks (load balancer)

| Probe | Path | Expect |
| --- | --- | --- |
| Liveness | `GET /health` | `200` |
| Readiness | `GET /ready` | `200` (not `503`) |

### 9.2 Logs

Structured JSON to stdout. Base fields on every line: `service`, `instance_id`, `level`, `msg`, `time`.

| `msg` | Meaning |
| --- | --- |
| `aihay_starting` / `aihay_listening` | Boot |
| `store_memory` / `store_postgres` | Persistence mode |
| **`request_complete`** | **V2.0 — one line per terminal chat request** (no prompts) |
| `chat_success` / `chat_stream_committed` | Happy path internals |
| `chat_attempt_failed` / `chat_stream_attempt_failed` | Upstream attempt failed (may failover) |
| `request_error` | Client-facing AppError |
| `usage_insert_failed` | Metering write failed (request may still have succeeded) |
| `redis_unavailable_using_memory_limiter` | Redis down; local RPM only |

**`request_complete` fields (metadata only):**  
`request_id`, `workspace_id`, `api_key_id`, `route`, `stream`, `model_requested`, `model_used`, `provider`, `status`, `http_status`, `latency_ms`, `ttft_ms`, `attempt_count`, `prompt_tokens`, `completion_tokens`, `cost_usd_estimate`, `credential_mode`, `error_code`.

```bash
docker compose logs api 2>&1 | grep request_complete
docker compose logs api 2>&1 | grep '<request-id>'
```

Always filter by `request_id` when debugging a single call. Disable completion logs: `FEATURE_COMPLETION_LOGS=false`.

### 9.2.1 Metrics (V2.0)

```bash
curl -s http://localhost:3000/metrics | head -50
```

| Series | Meaning |
| --- | --- |
| `aihay_http_requests_total{route,status}` | Completed instrumented requests |
| `aihay_request_duration_ms` | Latency histogram |
| `aihay_upstream_attempts_total{provider,result}` | success / retriable / error / missing_credential |
| `aihay_ttft_ms{provider}` | Stream time-to-first-token |
| `aihay_tokens_total{direction,provider}` | prompt / completion |
| `aihay_cost_usd_total` | Sum of estimates |
| `aihay_usage_enqueue_failures_total` | Ledger write failures |

Plus process defaults from `prom-client` (`process_*`, etc.).

Disable: `FEATURE_METRICS=false` → `/metrics` returns 404.

### 9.2.2 Suggested alerts

| Alert | Condition |
| --- | --- |
| API down | `/ready` failing |
| High error rate | rise in `aihay_http_requests_total` with `status=~5..` |
| Metering hole | `rate(aihay_usage_enqueue_failures_total[5m]) > 0` sustained |
| Upstream pain | high `aihay_upstream_attempts_total{result="error\|retriable"}` |

### 9.3 Usage / metering

- One `usage_events` row per **terminal** request (Postgres or memory buffer).
- Fields include model requested/used, provider, tokens, cost estimate, latency, status, attempt count.
- Prompts/completions are **not** stored by default.

Inspect (Postgres):

```sql
SELECT request_id, model_used, provider, prompt_tokens, completion_tokens,
       cost_usd_estimate, status, attempt_count, created_at
FROM usage_events
ORDER BY created_at DESC
LIMIT 20;
```

### 9.4 Smoke script

Against a running server:

```bash
# partial (no live chat unless keys + SMOKE_LIVE)
pnpm smoke

OPENAI_API_KEY=sk-... SMOKE_LIVE=1 \
  AIHAY_API_KEY=sk-aihay-dev-local \
  SMOKE_BASE_URL=http://127.0.0.1:3000 \
  pnpm smoke
```

### 9.5 Spike (provider-only debug)

Bypasses the gateway; uses raw provider keys:

```bash
pnpm spike:chat --provider openai --model gpt-4o-mini
pnpm spike:chat --provider anthropic --model claude-3-5-haiku-latest
pnpm spike:chat --provider xai --model grok-4.5
```

Use when isolating adapter vs gateway issues. See spike notes in [implementation plan](./design/implementation-plan-v1.md) Phase 0.

---

## 10. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `401` invalid API key | Wrong Bearer / revoked / pepper mismatch | Check key; list/revoke; ensure same `AIHAY_KEY_PEPPER` as mint time |
| `400` unknown model | Id not in `models.yaml` | `GET /v1/models`; fix id (`provider/model`) |
| `400` unsupported_parameter | Tools or vision content | Text-only messages in V1 |
| `429` rate limit | RPM exceeded | Wait / raise `DEFAULT_RPM` or key rpm |
| `429` daily_limit_exceeded | Daily token soft cap | Wait until UTC day rolls or raise limit |
| `502` upstream_unavailable | Missing platform key or all providers failing | Set env keys; check provider status; use spike |
| Health OK, chat fails | No `OPENAI_API_KEY` / etc. | Boot log shows `*_configured: false` |
| Stream dies mid-way | Upstream drop after commit | Expected: no mid-stream model switch; check provider |
| Keys disappear after restart | Memory store | Use Postgres + `STORE_DRIVER=postgres` |
| `/ready` 503 | Postgres unreachable | Check `DATABASE_URL`, Compose health |
| Redis log warning | Redis down | Service still runs with memory limiter (not multi-instance safe) |
| Cost looks wrong | Seed prices illustrative | Update `models.yaml` prices; raw tokens still stored |

**Error body shape (OpenAI-like)**

```json
{
  "error": {
    "message": "...",
    "type": "invalid_request_error",
    "code": "model_not_found",
    "param": "model"
  }
}
```

---

## 11. Incident playbooks

### 11.1 Provider outage (e.g. OpenAI 5xx)

1. Confirm with spike or provider status page.
2. Clients can set `models: ["anthropic/…"]` or `"xai/…"` fallback on requests.
3. Optionally edit `fallback_models` in `models.yaml` and restart API.
4. Watch logs for `chat_attempt_failed` → `chat_success` with different `provider`.

### 11.2 Compromised AI Hay key

1. `pnpm keys revoke --prefix sk-aihay-<prefix>`
2. Mint a new key; update clients.
3. Review `usage_events` for that `api_key_id` after compromise window.
4. If platform provider keys may be exposed, rotate those at OpenAI/Anthropic/xAI consoles.

### 11.3 Cost runaway

1. Lower `DEFAULT_RPM` / `DEFAULT_MAX_TOKENS`; restart.
2. Revoke high-spend keys.
3. Temporarily unset provider env keys to hard-stop upstream spend (chat will 502).
4. Inspect usage table for top keys/models.

### 11.4 Full process restart

```bash
# local
# Ctrl+C then:
pnpm dev

# compose
docker compose restart api
# or
docker compose up -d --build api
```

Memory store: re-create keys. Postgres: keys persist.

---

## 12. Build, test, release checklist

```bash
pnpm install
pnpm test          # must pass (no live network)
pnpm typecheck
pnpm build         # emits apps/api/dist + schema/models copy
```

**Pre-deploy**

- [ ] `AIHAY_KEY_PEPPER` set and backed up
- [ ] `AIHAY_DEV_KEY` disabled or randomized if public
- [ ] Provider keys injected via secrets manager
- [ ] `DATABASE_URL` + `REDIS_URL` for multi-instance
- [ ] `/health` and `/ready` wired to orchestrator
- [ ] Smoke against staging with live key
- [ ] Log aggregation on stdout JSON

---

## 13. Common commands cheat sheet

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm keys create --name <name>
pnpm keys list
pnpm keys revoke --prefix sk-aihay-xxxx
pnpm migrate
pnpm smoke
pnpm spike:chat --provider openai|anthropic|xai --model <upstream-id>
docker compose up --build
docker compose logs -f api
docker compose down
```

---

## 14. Scope reminders (V1)

| In runbook scope | Not in V1 product |
| --- | --- |
| Operate self-host / Compose | Public multi-tenant signup |
| CLI keys | Dashboard UI |
| Metering tables/logs | Stripe / credits |
| Text chat + fallbacks | Tools/vision, smart auto-routing |

When behavior contradicts this runbook, prefer **code + Architecture V1**, then update this file.

---

*Runbook V1 — update when ports, env vars, store drivers, or operational procedures change.*
