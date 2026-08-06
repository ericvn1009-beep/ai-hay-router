# Adapter quirks (Phase 0 notes)

## OpenAI

- Near-passthrough Chat Completions API.
- Stream: enable `stream_options.include_usage` when streaming so final chunk may carry usage.
- Auth: `Authorization: Bearer …`.

## Anthropic

- Uses **Messages API** (`/v1/messages`), not OpenAI-compatible natively.
- `system` must be a top-level field, not a message role — adapter splits system messages out.
- Requires `max_tokens` always — we default to 1024 if missing, gateway clamps via `DEFAULT_MAX_TOKENS`.
- Auth: `x-api-key` + `anthropic-version` header.
- Stream events: `message_start`, `content_block_delta` (text_delta), `message_delta` (stop + usage).
- Stop reasons: `end_turn` → OpenAI `stop`; `max_tokens` → `length`.

## xAI (Grok)

- OpenAI-compatible Chat Completions at `https://api.x.ai/v1`.
- Auth: `Authorization: Bearer $XAI_API_KEY` (same shape as OpenAI).
- Adapter reuses OpenAI request/stream path with `id: "xai"`.
- Canonical model ids: `xai/grok-4.5`, `xai/grok-3`, `xai/grok-3-mini` (upstream ids without prefix).
- Confirm current model ids and pricing on https://docs.x.ai / console when deploying.

## V1 content policy

- Tools / function calling / vision: rejected at validation layer before adapters.
- Tool roles in message history: rejected.
