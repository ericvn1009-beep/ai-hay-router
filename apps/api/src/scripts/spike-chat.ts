/**
 * Phase 0 spike: call a single provider non-stream and print normalized JSON.
 *
 * Usage:
 *   pnpm spike:chat --provider openai --model gpt-4o-mini
 *   pnpm spike:chat --provider anthropic --model claude-3-5-haiku-latest
 */
import { createAnthropicAdapter } from "../providers/anthropic/index.js";
import { createOpenAIAdapter } from "../providers/openai/index.js";
import type { ChatAdapter } from "../providers/types.js";
import type { NormalizedChatRequest } from "../types/chat.js";

function arg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

async function main() {
  const provider = arg("provider", "openai");
  const model = arg(
    "model",
    provider === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini",
  );
  const prompt = arg("prompt", "Say hello in one short sentence.");

  let adapter: ChatAdapter;
  let apiKey: string;

  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    adapter = createOpenAIAdapter({ apiKey });
  } else if (provider === "anthropic") {
    apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
    adapter = createAnthropicAdapter({ apiKey });
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const input: NormalizedChatRequest = {
    model,
    messages: [{ role: "user", content: prompt }],
    stream: false,
    max_tokens: 64,
  };

  const req = adapter.buildRequest(input, model);
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(text);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const completion = adapter.parseResponse(json, {
    requestId: "spike",
    logicalModel: `${provider}/${model}`,
    upstreamModel: model,
  });

  console.log(JSON.stringify(completion, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
