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

## V1 content policy

- Tools / function calling / vision: rejected at validation layer before adapters.
- Tool roles in message history: rejected.
