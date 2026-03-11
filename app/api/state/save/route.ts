import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  state?: Record<string, unknown>;
  accessToken?: string;
};

function getBearerToken(req: NextRequest, body: Body): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return body.accessToken?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const state = body.state ?? null;
    if (!state || typeof state !== "object") {
      return NextResponse.json({ ok: false, error: "missing state" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "missing supabase credentials" },
        { status: 500 }
      );
    }

    const token = getBearerToken(req, body);
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing access token" }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { error } = await adminClient
      .from("user_app_state")
      .upsert({ user_id: authData.user.id, state }, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: `save failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
