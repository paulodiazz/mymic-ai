import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LastWebhook = {
  at: string;
  headers: Record<string, string>;
  body: unknown;
};

const getDebugSecret = () => (process.env.HEYREACH_WEBHOOK_DEBUG_SECRET ?? "").trim();
const isAuthorized = (req: NextRequest) => {
  const secret = getDebugSecret();
  if (!secret) return true;
  const header = req.headers.get("x-heyreach-debug-secret")?.trim() ?? "";
  const query = new URL(req.url).searchParams.get("secret")?.trim() ?? "";
  return header === secret || query === secret;
};

let lastWebhook: LastWebhook | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    lastWebhook = {
      at: new Date().toISOString(),
      headers,
      body,
    };
    console.log("[heyreach] webhook received", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!lastWebhook) {
    return NextResponse.json({ ok: false, error: "no webhook received yet" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lastWebhook });
}
