# AI Hay Router

**Version `0.7.0`** — OpenAI-compatible multi-model LLM gateway (TypeScript / Hono).

One AI Hay API key → **OpenAI + Anthropic (Claude) + xAI (Grok)** with streaming, aliases, fallbacks, usage metering, control plane, dashboard, budgets, BYOK, credits, and optional tools/vision.

## Features

| Area | What you get |
| --- | --- |
| Data plane | `POST /v1/chat/completions`, `GET /v1/models` (OpenAI SDK drop-in) |
| Providers | OpenAI, Anthropic, xAI (Grok) |
| Aliases | `aihay/cheap`, `aihay/balanced`, `aihay/smart`, `aihay/fast` |
| Auth | Dev key, CLI/hashed keys, dashboard session auth |
| Tenancy | Orgs, workspaces, memberships, audit log |
| Ops | JSON logs (`request_complete`), Prometheus `/metrics` |
| Limits | RPM, daily tokens, workspace budgets |
| Commercial | BYOK (encrypted), prepaid credits/wallet |
| Rich API | Tools + vision when `FEATURE_TOOLS_VISION=true` and model supports |
| Dashboard | Keys, usage, BYOK, wallet (`apps/web` :3001) |

## Quickstart (local, memory store)

```bash
# Node 22+ and pnpm
pnpm install
cp .env.example .env
# optional for live chat: OPENAI_API_KEY / ANTHROPIC_API_KEY / XAI_API_KEY

pnpm test
pnpm dev          # API  http://localhost:3000
pnpm dev:web      # UI   http://localhost:3001  (API must be running)
```

```bash
curl -s localhost:3000/health
curl -s localhost:3000/v1/models \
  -H "Authorization: Bearer sk-aihay-dev-local"
```

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_API_KEY ?? "sk-aihay-dev-local",
});

const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini", // or aihay/cheap
  messages: [{ role: "user", content: "hi" }],
  stream: true,
});
```

## Docker Compose

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export XAI_API_KEY=xai-...

# API + Postgres + Redis
docker compose up --build -d

# API + web dashboard + Postgres + Redis
docker compose --profile full up --build -d
# API :3000  ·  Web :3001  ·  Postgres :5432  ·  Redis :6379
```

Schema migrations run automatically on API boot when using Postgres. Manual apply:

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay pnpm migrate
```

Durable API key (same DB as Compose):

```bash
DATABASE_URL=postgres://aihay:aihay@localhost:5432/aihay \
STORE_DRIVER=postgres \
AIHAY_KEY_PEPPER=change-me-in-production \
pnpm keys create --name compose-dev
```

## Models

| AI Hay id | Provider | tools | vision |
| --- | --- | --- | --- |
| `openai/gpt-4o-mini`, `openai/gpt-4o` | OpenAI | yes | yes |
| `anthropic/claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5` | Anthropic | yes | yes |
| `xai/grok-4.5` | xAI | yes | yes |
| `xai/grok-3`, `xai/grok-3-mini` | xAI | yes | no |
| `aihay/cheap` → `openai/gpt-4o-mini` | alias | — | — |
| `aihay/balanced` → `anthropic/claude-haiku-4-5` | alias | — | — |
| `aihay/smart` → `openai/gpt-4o` | alias | — | — |
| `aihay/fast` → `xai/grok-3-mini` | alias | — | — |

Registry: `apps/api/models.yaml`.

## Commands

```bash
pnpm install
pnpm dev / pnpm dev:web / pnpm dev:full
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

./sample_test.sh          # needs AIHAY_API_KEY or uses dev key
```

## Feature flags

See [`.env.example`](./.env.example). Common ones:

| Flag | Default | Effect |
| --- | --- | --- |
| `FEATURE_CONTROL_PLANE` | `true` | `/control/v1/*` + dashboard auth |
| `FEATURE_ALIASES` | `true` | `aihay/*` model ids |
| `FEATURE_BUDGETS` | `true` | Workspace daily hard/soft caps |
| `FEATURE_BYOK` | `false` | Workspace provider secrets |
| `FEATURE_CREDITS` | `false` | Prepaid wallet |
| `FEATURE_TOOLS_VISION` | `false` | Tools + multimodal messages |
| `FEATURE_METRICS` | `true` | `GET /metrics` |
| `FEATURE_COMPLETION_LOGS` | `true` | `request_complete` log lines |

## Ops

**[Runbook](./docs/runbook.md)** — configure, deploy, keys, control plane, BYOK, credits, metrics, troubleshooting.

## Design docs

| Doc | Role |
| --- | --- |
| [Product Spec](./docs/design/product-spec.md) | Product intent |
| [Architecture](./docs/design/architecture-v2.md) | System design (current product surface) |
| [Scalability](./docs/design/scalability.md) | Scale stages and capacity notes |
| [Implementation Plan](./docs/design/implementation-plan-v2.md) | Shipped phase record |
| [V3 TODO](./docs/design/v3_todo.md) | Backlog: platform admin UI, ops monitor, smart routing |
| [Runbook](./docs/runbook.md) | Operate and debug |

Historical design notes: `architecture-v1.md`, `implementation-plan-v1.md` (archived planning).

## Research

See [`docs/`](./docs/) for market research (OpenRouter, routers vs gateways, COGS, etc.).
