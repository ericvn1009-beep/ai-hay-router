# AI Hay Router — Runbook

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Version** | `0.7.0` |
| **Audience** | Operators and engineers |
| **Last updated** | 2026-08-06 |
| **Related** | [README](../README.md) · [Architecture](./design/architecture-v2.md) · [`.env.example`](../.env.example) |

How to **start**, **configure**, **issue keys**, **operate** the control plane and commercial hooks, **verify health**, **debug**, and **recover**.

---

## 1. System overview

```text
Client (OpenAI SDK / curl / dashboard)
        │  Bearer sk-aihay-…  or  AIHAY_DEV_KEY
        │  Session cookie (control plane)
        ▼
┌──────────────────────────────────────────────────┐
│  AI Hay API (Hono / Node 22)  :3000              │
│  auth · RPM · budgets · credits · aliases        │
│  BYOK resolve · adapters · stream · usage        │
│  /control/v1 · /metrics · request_complete logs  │
└───────────┬──────────────────┬───────────────────┘
            │                  │
     Postgres / Redis    OpenAI · Anthropic · xAI
     (optional)          platform keys and/or BYOK

  apps/web :3001  →  proxies /api/control → API
```

| Mode | When to use |
| --- | --- |
| **Memory** | Local dev; state lost on restart |
| **Postgres + Redis** | Durable keys/usage + multi-instance RPM |
| **Compose full** | API + dashboard + Postgres + Redis |

---

## 2. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js **22+** | |
| **pnpm** | `packageManager` in root `package.json` |
| Docker (optional) | Compose: api, postgres, redis, optional web |
| Provider keys | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY` for platform-path chat |

```bash
node -v    # >= 22
pnpm -v
```

---

## 3. Configuration

```bash
cp .env.example .env
```

### Core

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `SERVICE_NAME` | `aihay-api` | Log / metrics label |
| `INSTANCE_ID` | hostname | Instance label |
| `AIHAY_DEV_KEY` | `sk-aihay-dev-local` | Fixed Bearer for local dev |
| `AIHAY_KEY_PEPPER` | `dev-pepper-…` | HMAC pepper for API key hashes — **change in shared envs** |
| `SESSION_SECRET` | `dev-session-…` | Control-plane session signing |
| `STORE_DRIVER` | `auto` | `auto` \| `memory` \| `postgres` |
| `DATABASE_URL` | — | Postgres URL |
| `REDIS_URL` | — | Redis for RPM/daily counters |
| `OPENAI_API_KEY` | — | Platform OpenAI key |
| `ANTHROPIC_API_KEY` | — | Platform Anthropic key |
| `XAI_API_KEY` | — | Platform xAI key |
| `REQUEST_TIMEOUT_MS` | `120000` | Per-attempt upstream timeout |
| `DEFAULT_MAX_TOKENS` | `4096` | Default and clamp for `max_tokens` |
| `DEFAULT_RPM` | `60` | Per-key RPM if key has no override |
| `MAX_ATTEMPTS` | `3` | Max failover/fallback attempts |

### Feature flags

| Variable | Default | Purpose |
| --- | --- | --- |
| `FEATURE_COMPLETION_LOGS` | `true` | `request_complete` log lines |
| `FEATURE_METRICS` | `true` | Prometheus `GET /metrics` |
| `FEATURE_OTEL` | `false` | OTel hooks (stub-friendly) |
| `FEATURE_CONTROL_PLANE` | `true` | `/control/v1/*` session APIs |
| `FEATURE_ALIASES` | `true` | `aihay/*` virtual models |
| `FEATURE_BUDGETS` | `true` | Workspace daily hard/soft budgets |
| `FEATURE_BYOK` | `false` | Workspace provider secrets |
| `BYOK_MASTER_KEY` | — | AES master key (base64 32 bytes or 64-char hex) |
| `FEATURE_CREDITS` | `false` | Prepaid wallet |
| `CREDITS_BYOK_BYPASS` | `true` | Skip wallet when BYOK is configured for provider |
| `STRIPE_WEBHOOK_SECRET` | — | Shared secret for credit webhooks |
| `FEATURE_TOOLS_VISION` | `false` | Tools + multimodal content |
| `AIHAY_API_URL` | — | Dashboard BFF target (web only) |

**Security**

- Never commit `.env`.
- Rotating `AIHAY_KEY_PEPPER` invalidates all hashed keys (re-issue required).
- Do not expose `AIHAY_DEV_KEY` on the public internet.
- **BYOK:** set a dedicated `BYOK_MASTER_KEY` in production; never log secret material. Losing the master key requires customers to re-enter provider keys.

---

## 4. Local run (memory)

```bash
pnpm install
cp .env.example .env
# optional: OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY

pnpm test
pnpm typecheck
pnpm dev              # http://localhost:3000
pnpm dev:web          # http://localhost:3001  (separate terminal)
# or: pnpm dev:full
```

**Verify**

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-aihay-dev-local"
```

**Chat**

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

**Alias example**

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-aihay-dev-local" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aihay/cheap",
    "messages": [{"role":"user","content":"hi"}],
    "stream": false
  }'
```

**OpenAI SDK**

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_API_KEY ?? "sk-aihay-dev-local",
});
```

**Sample script**

```bash
export AIHAY_API_KEY=sk-aihay-dev-local   # or a real key
./sample_test.sh
```

---

## 5. Docker Compose

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export XAI_API_KEY=xai-...
export AIHAY_KEY_PEPPER=strong-random-value
export SESSION_SECRET=strong-session-secret

# API + Postgres + Redis
docker compose up --build -d

# + dashboard on :3001
docker compose --profile full up --build -d
```

| Service | Port |
| --- | --- |
| api | `3000` |
| web (profile `full`) | `3001` |
| postgres | `5432` |
| redis | `6379` |

**Migrations:** applied automatically on API boot with Postgres. Manual:

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay pnpm migrate
# applies apps/api/migrations/*.sql (tracked in schema_migrations)
```

**Durable key (CLI → same DB):**

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay \
STORE_DRIVER=postgres \
AIHAY_KEY_PEPPER=strong-random-value \
pnpm keys create --name compose-dev
# Copy sk-aihay-… once
```

```bash
docker compose logs -f api
docker compose down
# docker compose down -v   # destroys DB volume
```

---

## 6. API keys

| Command | Action |
| --- | --- |
| `pnpm keys create --name <label>` | Mint key; prints secret **once** |
| `pnpm keys list` | List prefix, name, revoked |
| `pnpm keys revoke --prefix sk-aihay-xxxx` | Soft-revoke |
| `pnpm keys workspace-create --name <n>` | Extra workspace (Postgres/memory) |
| `pnpm keys workspaces` | List workspaces |

Keys can also be created in the **dashboard** or control API.

**Auth (data plane)**

1. `Authorization: Bearer <token>`
2. Matches `AIHAY_DEV_KEY` → accept (dev identity)
3. Else `sk-aihay-…` → HMAC with pepper → `api_keys` lookup
4. Revoked / unknown → `401`
5. Over RPM / daily tokens → `429`
6. Hard budget → `429` `budget_exceeded`
7. Credits empty (platform path) → `402` `insufficient_credits`

Memory-mode keys die with the process; use Postgres for durability.

---

## 7. Models and providers

Seed: `apps/api/models.yaml`.

| AI Hay model id | Provider | Credential | tools | vision |
| --- | --- | --- | --- | --- |
| `openai/gpt-4o-mini`, `openai/gpt-4o` | OpenAI | `OPENAI_API_KEY` or BYOK | yes | yes |
| `anthropic/claude-3-5-haiku-latest`, `anthropic/claude-sonnet-4-0` | Anthropic | `ANTHROPIC_API_KEY` or BYOK | yes | yes |
| `xai/grok-4.5` | xAI | `XAI_API_KEY` or BYOK | yes | yes |
| `xai/grok-3`, `xai/grok-3-mini` | xAI | `XAI_API_KEY` or BYOK | yes | no |

**Aliases** (`FEATURE_ALIASES=true`): `aihay/cheap`, `aihay/balanced`, `aihay/smart`, `aihay/fast`.

```bash
curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer $AIHAY_API_KEY"
```

**Fallback:** body `models: ["xai/grok-3-mini"]` or `fallback_models` in YAML. Stream failover only **before** first client SSE byte.

**Tools / vision:** require `FEATURE_TOOLS_VISION=true` **and** model capability flags. Unsupported combo → `400` `unsupported_parameter`.

---

## 8. HTTP surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Liveness |
| `GET` | `/ready` | No | Readiness (DB ping if Postgres) |
| `GET` | `/metrics` | No | Prometheus text |
| `GET` | `/v1/models` | API key | Model list (+ aliases) |
| `POST` | `/v1/chat/completions` | API key | Chat (stream / non-stream) |
| `*` | `/control/v1/*` | Session cookie | Control plane |

Response headers (chat): `x-request-id`, `x-aihay-model`, `x-aihay-provider`, `x-aihay-credential-mode`.

Protect `/metrics` at the edge in production.

---

## 9. Control plane

Session cookie `aihay_session`. **API keys cannot call `/control/*`.** Catalog: `GET /control/v1`.

```bash
# Register
curl -s -c cookies.txt -X POST localhost:3000/control/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'

# Login
curl -s -c cookies.txt -X POST localhost:3000/control/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}'

WS=$(curl -s -b cookies.txt localhost:3000/control/v1/me | jq -r '.workspaces[0].id')

# API key
curl -s -b cookies.txt -X POST "localhost:3000/control/v1/workspaces/$WS/keys" \
  -H 'Content-Type: application/json' \
  -d '{"name":"app"}'

# Usage
curl -s -b cookies.txt "localhost:3000/control/v1/workspaces/$WS/usage?limit=20"
curl -s -b cookies.txt "localhost:3000/control/v1/workspaces/$WS/usage/summary"

# Budget
curl -s -b cookies.txt "localhost:3000/control/v1/workspaces/$WS/budget"
curl -s -b cookies.txt -X PUT "localhost:3000/control/v1/workspaces/$WS/budget" \
  -H 'Content-Type: application/json' \
  -d '{"hard_cost_usd_daily":10,"soft_cost_usd_daily":5}'
```

Disable: `FEATURE_CONTROL_PLANE=false`.

### Dashboard

```bash
pnpm dev                 # terminal 1
pnpm dev:web             # terminal 2 → http://localhost:3001

# Compose
docker compose --profile full up --build -d
```

Pages: `/register`, `/login`, `/keys`, `/usage`, `/byok`, `/wallet`.

---

## 10. BYOK

Order: **workspace BYOK → platform env → fail**. Logs/usage record `credential_mode: platform|byok`.

```bash
# FEATURE_BYOK=true  and  BYOK_MASTER_KEY=<secret>

curl -s -b cookies.txt -X PUT \
  "localhost:3000/control/v1/workspaces/$WS/providers/openai/secret" \
  -H 'Content-Type: application/json' \
  -d '{"api_key":"sk-..."}'
# → key_hint only; raw secret never returned

curl -s -b cookies.txt "localhost:3000/control/v1/workspaces/$WS/providers"

curl -s -b cookies.txt -X DELETE \
  "localhost:3000/control/v1/workspaces/$WS/providers/openai/secret"
```

| Event | Action |
| --- | --- |
| Rotate master key | New `BYOK_MASTER_KEY`; re-save all customer secrets |
| Customer key leaked | `DELETE` secret; rotate at provider |
| Lost master key | Ciphertext unrecoverable; wipe `provider_secrets` and re-onboard |

---

## 11. Credits / wallet

With `FEATURE_CREDITS=true`, platform-path chat needs balance &gt; 0 else **402** `insufficient_credits`. Success debits estimated cost (idempotent on `request_id`). BYOK skips billing when `CREDITS_BYOK_BYPASS=true`.

```bash
curl -s -b cookies.txt "localhost:3000/control/v1/workspaces/$WS/wallet"

curl -s -b cookies.txt -X POST \
  "localhost:3000/control/v1/workspaces/$WS/wallet/credit" \
  -H 'Content-Type: application/json' \
  -d '{"amount_usd":50,"idempotency_key":"promo-1"}'

# Webhook (idempotent on event_id)
curl -s -X POST localhost:3000/control/v1/webhooks/credits \
  -H 'Content-Type: application/json' \
  -H "X-Credits-Webhook-Secret: $STRIPE_WEBHOOK_SECRET" \
  -d "{\"event_id\":\"evt_123\",\"workspace_id\":\"$WS\",\"amount_usd\":25}"
```

Refunds: out-of-band ops (manual credit / process).

---

## 12. Day-2 operations

### Health

| Probe | Path | Expect |
| --- | --- | --- |
| Liveness | `GET /health` | `200` |
| Readiness | `GET /ready` | `200` (not `503`) |

### Logs

Structured JSON stdout. Base fields: `service`, `instance_id`, `level`, `msg`, `time`.

| `msg` | Meaning |
| --- | --- |
| `aihay_starting` / `aihay_listening` | Boot |
| `store_memory` / `store_postgres` | Persistence mode |
| **`request_complete`** | One line per terminal chat (no prompts) |
| `chat_success` / `chat_stream_committed` | Happy path |
| `chat_attempt_failed` | Upstream attempt failed (may failover) |
| `budget_soft_warning` | Soft budget exceeded |
| `usage_insert_failed` | Metering write failed |
| `credit_debit_failed` | Wallet debit failed after success |
| `redis_unavailable_using_memory_limiter` | Redis down; in-process RPM |

**`request_complete` fields:**  
`request_id`, `workspace_id`, `api_key_id`, `route`, `stream`, `model_requested`, `model_used`, `provider`, `status`, `http_status`, `latency_ms`, `ttft_ms`, `attempt_count`, `prompt_tokens`, `completion_tokens`, `cost_usd_estimate`, `credential_mode`, `error_code`.

```bash
docker compose logs api 2>&1 | grep request_complete
docker compose logs api 2>&1 | grep '<request-id>'
```

### Metrics

```bash
curl -s http://localhost:3000/metrics | head -50
```

| Series | Meaning |
| --- | --- |
| `aihay_http_requests_total{route,status}` | Requests |
| `aihay_request_duration_ms` | Latency histogram |
| `aihay_upstream_attempts_total{provider,result}` | success / retriable / error / missing_credential |
| `aihay_ttft_ms{provider}` | Stream TTFT |
| `aihay_tokens_total{direction,provider}` | prompt / completion |
| `aihay_cost_usd_total` | Cost estimates sum |
| `aihay_usage_enqueue_failures_total` | Ledger write failures |

### Suggested alerts

| Alert | Condition |
| --- | --- |
| API down | `/ready` failing |
| High error rate | `status=~5..` rising |
| Metering hole | `rate(aihay_usage_enqueue_failures_total[5m]) > 0` |
| Upstream pain | high `result="error\|retriable"` |

### Usage SQL (Postgres)

```sql
SELECT request_id, model_used, provider, credential_mode,
       prompt_tokens, completion_tokens, cost_usd_estimate,
       status, attempt_count, created_at
FROM usage_events
ORDER BY created_at DESC
LIMIT 20;
```

### Smoke / spike

```bash
pnpm smoke

OPENAI_API_KEY=sk-... SMOKE_LIVE=1 \
  AIHAY_API_KEY=sk-aihay-dev-local \
  SMOKE_BASE_URL=http://127.0.0.1:3000 \
  pnpm smoke

# Bypasses gateway — raw provider
pnpm spike:chat --provider openai --model gpt-4o-mini
pnpm spike:chat --provider anthropic --model claude-3-5-haiku-latest
pnpm spike:chat --provider xai --model grok-4.5
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `401` | Bad/revoked key or pepper mismatch | Check key; same `AIHAY_KEY_PEPPER` as mint |
| `400` unknown model | Not in registry / alias off | `GET /v1/models`; enable `FEATURE_ALIASES` |
| `400` unsupported_parameter | Tools/vision off or model lacks capability | Set `FEATURE_TOOLS_VISION` or use text-only |
| `402` insufficient_credits | Empty wallet on platform path | Credit wallet or enable BYOK bypass |
| `429` rate limit | RPM | Raise `DEFAULT_RPM` or key rpm |
| `429` budget_exceeded | Hard budget | Raise budget or wait for day rollover |
| `429` daily_limit_exceeded | Daily token cap | Raise limit or wait UTC day |
| `502` upstream_unavailable | Missing keys or all providers down | Set platform/BYOK keys; spike provider |
| Keys gone after restart | Memory store | Use Postgres |
| `/ready` 503 | DB down | Check `DATABASE_URL` / Compose |
| Redis warning | Redis down | Single-node memory limiter only |

**Error body**

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

## 14. Incidents

### Provider outage

1. Confirm with spike or provider status.
2. Clients set `models: ["anthropic/…"]` or `"xai/…"` fallback.
3. Or edit `fallback_models` in `models.yaml` and restart.
4. Watch `chat_attempt_failed` → success on another `provider`.

### Compromised AI Hay key

1. `pnpm keys revoke --prefix sk-aihay-<prefix>` (or dashboard revoke).
2. Mint a new key; update clients.
3. Review `usage_events` for that key.
4. Rotate platform/BYOK provider keys if they may be exposed.

### Cost runaway

1. Lower `DEFAULT_RPM` / `DEFAULT_MAX_TOKENS`; tighten budgets.
2. Revoke high-spend keys.
3. Unset platform keys or zero credits to hard-stop spend.
4. Inspect usage and wallet ledger.

### Restart

```bash
pnpm dev
# compose:
docker compose restart api
docker compose up -d --build api
```

Memory store: re-create keys. Postgres: keys persist.

---

## 15. Build / deploy checklist

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

**Pre-deploy**

- [ ] `AIHAY_KEY_PEPPER` and `SESSION_SECRET` strong and backed up
- [ ] `AIHAY_DEV_KEY` disabled or random if public
- [ ] Provider keys via secrets manager
- [ ] `DATABASE_URL` + `REDIS_URL` for multi-instance
- [ ] `BYOK_MASTER_KEY` if `FEATURE_BYOK=true`
- [ ] `/health` and `/ready` on orchestrator
- [ ] Staging smoke with live key
- [ ] Log aggregation on stdout JSON
- [ ] `/metrics` not public

---

## 16. Command cheat sheet

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:full
pnpm test
pnpm typecheck
pnpm build
pnpm start

pnpm keys create --name <name>
pnpm keys list
pnpm keys revoke --prefix sk-aihay-xxxx
pnpm migrate
pnpm smoke
pnpm spike:chat --provider openai|anthropic|xai --model <upstream-id>
./sample_test.sh

docker compose up --build -d
docker compose --profile full up --build -d
docker compose logs -f api
docker compose down
```

---

## 17. Product scope (current)

| In scope | Out of scope (for now) |
| --- | --- |
| Multi-provider chat gateway | Smart auto-routing (`aihay/auto` → V3) |
| Control plane + dashboard | Full Stripe Checkout UI (webhook credit path exists) |
| Budgets, BYOK, credits | Mid-stream model switch |
| Tools/vision per capability matrix | Prompt storage by default |
| Stream-through SSE | 100+ providers |

When behavior contradicts this runbook, prefer **running code**, then update this file.
