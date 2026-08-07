import { type NextRequest, NextResponse } from "next/server";

const API_URL = (process.env.AIHAY_API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

async function proxy(req: NextRequest, path: string[]) {
  const suffix = path.join("/");
  const url = new URL(req.url);
  const target = `${API_URL}/admin/v1/${suffix}${url.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.text();
  const resHeaders = new Headers();
  resHeaders.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  return new NextResponse(body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
