# ai-hay-router

**AI Hay Router** — OpenAI-compatible multi-model gateway (TypeScript / Hono).

One API key → **OpenAI + Anthropic (Claude) + xAI (Grok)**, streaming, model fallbacks, usage metering.

## Status (V1)

| Phase | Status |
| --- | --- |
| 0 Spike adapters | Done |
| 1a–1d V1 gateway | Done |
| **V2.0 Observability** | Done — `request_complete` logs + `GET /metrics` |
| **V2.1 Tenancy** | Done — orgs/workspaces migrations + isolation |
| **V2.2 Control plane API** | Done — `/control/v1` auth, keys, usage, invites |
| **V2.3 Dashboard** | Done — `apps/web` at port 3001 |
| Tag | `0.4.0` |

## Quickstart (memory mode — no Docker DB)

```bash
# Node 22+ and pnpm
pnpm install
cp .env.example .env
# optional: OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY for live chat

pnpm test
pnpm dev          # API http://localhost:3000
pnpm dev:web      # Dashboard http://localhost:3001 (needs API running)
```

### Dashboard (V2.3)

1. Start API with control plane (`FEATURE_CONTROL_PLANE=true`, default).
2. `pnpm dev:web` → open http://localhost:3001  
3. Register → create API key → use key on `:3000/v1/*`

```bash
# Full stack via Compose
docker compose --profile full up --build -d
# API :3000  ·  Web :3001  ·  Postgres  ·  Redis
```

```bash
# health
curl -s localhost:3000/health

# models (dev key)
curl -s localhost:3000/v1/models \
  -H "Authorization: Bearer sk-aihay-dev-local"

# create a real hashed key (memory store in process — use postgres for durable keys)
pnpm keys create --name local-dev
```

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_API_KEY ?? "sk-aihay-dev-local",
});

const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
  stream: true,
});
```

## Docker Compose (Postgres + Redis)

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export XAI_API_KEY=xai-...
docker compose up --build
```

### Models (seed)

| AI Hay id | Provider |
| --- | --- |
| `openai/gpt-4o-mini`, `openai/gpt-4o` | OpenAI |
| `anthropic/claude-3-5-haiku-latest`, `anthropic/claude-sonnet-4-0` | Anthropic |
| `xai/grok-4.5`, `xai/grok-3`, `xai/grok-3-mini` | xAI Grok |

```bash
pnpm spike:chat --provider xai --model grok-4.5
```

Then create a durable key against the API container (or run CLI with `DATABASE_URL`):

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay \
AIHAY_KEY_PEPPER=change-me-in-production \
STORE_DRIVER=postgres \
pnpm keys create --name compose-dev
```

```bash
pnpm smoke   # partial without live keys; set OPENAI_API_KEY + SMOKE_LIVE=1 for full
```

## CLI

```bash
pnpm keys create --name <name>
pnpm keys list
pnpm keys revoke --prefix sk-aihay-xxxx
pnpm migrate          # apply schema (needs DATABASE_URL)
pnpm spike:chat --provider openai --model gpt-4o-mini
```

## V1 scope (locked)

- Text chat only (tools/vision → 400)
- CLI keys / optional dev key — **no user signup**
- Stream failover **before first client byte** only
- Model fallback primary reliability path
- Meter one usage row per terminal request

## Ops

- **[Runbook](./docs/runbook.md)** — start, configure, keys, health, troubleshooting, incidents

## Design docs

| Doc | Role |
| --- | --- |
| [Product Spec](./docs/design/product-spec.md) | What / why |
| [Architecture V1](./docs/design/architecture-v1.md) | System design (as-built gateway) |
| [Architecture V2](./docs/design/architecture-v2.md) | Productization target (tenancy, ops, commercial) |
| [Scalability](./docs/design/scalability.md) | Scale stages, RPS vs streams, multi-region / hyperscale |
| [Implementation Plan V1](./docs/design/implementation-plan-v1.md) | V1 phases + layout + testing |
| [Implementation Plan V2](./docs/design/implementation-plan-v2.md) | V2.0–V2.7 execution plan |
| [Runbook](./docs/runbook.md) | Operate and debug V1 |

## Research

See [`docs/`](./docs/) for market research (OpenRouter, routers vs gateways, COGS, etc.).
