/**
 * Smoke against a running server (default http://127.0.0.1:3000)
 *
 *   AIHAY_API_KEY=... pnpm smoke
 */
const base = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const key = process.env.AIHAY_API_KEY ?? process.env.AIHAY_DEV_KEY ?? "sk-aihay-dev-local";

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`/health ${health.status}`);
  console.log("ok health");

  const ready = await fetch(`${base}/ready`);
  if (!ready.ok) throw new Error(`/ready ${ready.status}`);
  console.log("ok ready");

  const models = await fetch(`${base}/v1/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!models.ok) throw new Error(`/v1/models ${models.status} ${await models.text()}`);
  console.log("ok models");

  if (!process.env.OPENAI_API_KEY && !process.env.SMOKE_LIVE) {
    console.log("skip chat (no OPENAI_API_KEY / SMOKE_LIVE); smoke partial ok");
    return;
  }

  const chat = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Say hi in one word." }],
      max_tokens: 8,
      stream: false,
    }),
  });
  if (!chat.ok) throw new Error(`chat ${chat.status} ${await chat.text()}`);
  console.log("ok chat non-stream");

  const streamRes = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Say hi." }],
      max_tokens: 8,
      stream: true,
    }),
  });
  if (!streamRes.ok) throw new Error(`stream ${streamRes.status}`);
  const text = await streamRes.text();
  if (!text.includes("data:")) throw new Error("stream missing SSE data");
  console.log("ok chat stream");
  console.log("smoke ok");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
