# ai-hay-router

**AI Hay Router** — OpenAI-compatible multi-model gateway (TypeScript / Hono).

One API key → **OpenAI + Anthropic (Claude) + xAI (Grok)**, streaming, model fallbacks, usage metering.

## Status (V1)

| Phase | Status |
| --- | --- |
| 0 Spike adapters | Done |
| 1a Wire API + stream | Done |
| 1b Keys, usage, limits | Done (memory or Postgres/Redis) |
| 1c Failover / fallback | Done |
| 1d Docker + smoke | Done |
| Tag | `0.1.0` (pre-release code) |

## Quickstart (memory mode — no Docker DB)

```bash
# Node 22+ and pnpm
pnpm install
cp .env.example .env
# optional: OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY for live chat

pnpm test
pnpm dev
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
