import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  state?: Record<string, unknown>;
  accessToken?: string;
};

type ArtifactRow = {
  user_id: string;
  bot_id: string;
  artifact_id: string;
  source_title?: string | null;
  action_credential_mode?: string | null;
  x_token?: string | null;
  x_api_key?: string | null;
  x_api_secret?: string | null;
  x_access_token?: string | null;
  x_access_token_secret?: string | null;
  plan: unknown[];
  day?: number | null;
  posted?: number[] | null;
  posted_tweet_ids?: string[] | null;
  campaign_id?: string | null;
};

function sanitizeStateForSave(state: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...state };
  if ("openaiApiKey" in next) next.openaiApiKey = "";
  if ("discordBotToken" in next) next.discordBotToken = "";

  if (Array.isArray(next.bots)) {
    next.bots = next.bots.map((bot) => {
      if (!bot || typeof bot !== "object") return bot;
      const clean = { ...(bot as Record<string, unknown>) };
      if ("discordBotToken" in clean) clean.discordBotToken = "";
      return clean;
    });
  }

  return next;
}

function getBearerToken(req: NextRequest, body: Body): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return body.accessToken?.trim() ?? "";
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
  return numbers.length ? numbers : null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value
    .map((item) => (typeof item === "string" ? item : String(item)))
    .filter((item) => item.trim().length > 0);
  return strings.length ? strings : null;
}

function extractArtifacts(state: Record<string, unknown>, userId: string): ArtifactRow[] {
  const bots = Array.isArray(state.bots) ? state.bots : [];
  const artifacts: ArtifactRow[] = [];
  const seen = new Set<string>();
  const activeBotId =
    typeof state.activeBotId === "string" ? (state.activeBotId as string) : "";
  const defaultBotId = activeBotId.trim() ? activeBotId : "default";
  const stateCampaignId =
    typeof state.campaignId === "string" ? (state.campaignId as string) : null;

  const pushArtifact = (
    artObj: Record<string, unknown>,
    botId: string,
    fallbackCampaignId: string | null,
  ) => {
    const artifactId = typeof artObj.id === "string" ? (artObj.id as string) : "";
    if (!artifactId.trim() || seen.has(artifactId)) return;
    seen.add(artifactId);

    const plan = Array.isArray(artObj.plan) ? (artObj.plan as unknown[]) : [];
    const dayRaw = typeof artObj.day === "number" ? artObj.day : Number(artObj.day);
    const day = Number.isFinite(dayRaw) ? dayRaw : null;
    const posted = toNumberArray(artObj.posted);
    const postedTweetIds = toStringArray(artObj.postedTweetIds);
    const campaignId =
      typeof artObj.campaignId === "string"
        ? (artObj.campaignId as string)
        : fallbackCampaignId;

    artifacts.push({
      user_id: userId,
      bot_id: botId,
      artifact_id: artifactId,
      source_title: typeof artObj.sourceTitle === "string" ? (artObj.sourceTitle as string) : null,
      action_credential_mode:
        typeof artObj.actionCredentialMode === "string"
          ? (artObj.actionCredentialMode as string)
          : null,
      x_token: typeof artObj.xToken === "string" ? (artObj.xToken as string) : null,
      x_api_key: typeof artObj.xApiKey === "string" ? (artObj.xApiKey as string) : null,
      x_api_secret:
        typeof artObj.xApiSecret === "string" ? (artObj.xApiSecret as string) : null,
      x_access_token:
        typeof artObj.xAccessToken === "string" ? (artObj.xAccessToken as string) : null,
      x_access_token_secret:
        typeof artObj.xAccessTokenSecret === "string"
          ? (artObj.xAccessTokenSecret as string)
          : null,
      plan,
      day,
      posted,
      posted_tweet_ids: postedTweetIds,
      campaign_id: campaignId,
    });
  };

  for (const bot of bots) {
    if (!bot || typeof bot !== "object") continue;
    const botId = typeof (bot as { id?: unknown }).id === "string" ? (bot as { id: string }).id : "";
    if (!botId.trim()) continue;

    const botObj = bot as Record<string, unknown>;
    const botCampaignId =
      typeof botObj.campaignId === "string" ? (botObj.campaignId as string) : stateCampaignId;
    const botArtifacts = Array.isArray(botObj.conversationArtifacts)
      ? botObj.conversationArtifacts
      : [];

    for (const artifact of botArtifacts) {
      if (!artifact || typeof artifact !== "object") continue;
      pushArtifact(artifact as Record<string, unknown>, botId, botCampaignId);
    }
  }

  const topLevelArtifacts = Array.isArray(state.conversationArtifacts)
    ? (state.conversationArtifacts as Array<Record<string, unknown>>)
    : [];
  for (const artifact of topLevelArtifacts) {
    if (!artifact || typeof artifact !== "object") continue;
    pushArtifact(artifact as Record<string, unknown>, defaultBotId, stateCampaignId);
  }

  return artifacts;
}

function toSqlInList(values: string[]): string {
  const quoted = values.map((value) => `'${value.replace(/'/g, "''")}'`);
  return `(${quoted.join(",")})`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const rawState = body.state ?? null;
    const state = rawState && typeof rawState === "object"
      ? sanitizeStateForSave(rawState as Record<string, unknown>)
      : null;
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
    const { error: stateError } = await adminClient
      .from("user_app_state")
      .upsert({ user_id: authData.user.id, state }, { onConflict: "user_id" });

    if (stateError) {
      return NextResponse.json(
        { ok: false, error: `save failed: ${stateError.message}` },
        { status: 500 }
      );
    }

    const autoPost = (state as Record<string, unknown>).autoPost;
    const normalizedAutoPost = autoPost === false ? false : true;
    const { error: settingsError } = await adminClient
      .from("user_settings")
      .upsert(
        { user_id: authData.user.id, auto_post: normalizedAutoPost },
        { onConflict: "user_id" }
      );

    if (settingsError) {
      return NextResponse.json(
        { ok: false, error: `save failed: ${settingsError.message}` },
        { status: 500 }
      );
    }

    const artifacts = extractArtifacts(state as Record<string, unknown>, authData.user.id);
    if (artifacts.length) {
      const { error: artifactsError } = await adminClient
        .from("conversation_artifacts")
        .upsert(artifacts, { onConflict: "user_id,artifact_id" });

      if (artifactsError) {
        return NextResponse.json(
          { ok: false, error: `save failed: ${artifactsError.message}` },
          { status: 500 }
        );
      }

      const artifactIds = artifacts.map((artifact) => artifact.artifact_id);
      const { error: cleanupError } = await adminClient
        .from("conversation_artifacts")
        .delete()
        .eq("user_id", authData.user.id)
        .not("artifact_id", "in", toSqlInList(artifactIds));

      if (cleanupError) {
        return NextResponse.json(
          { ok: false, error: `save failed: ${cleanupError.message}` },
          { status: 500 }
        );
      }
    } else {
      const { error: cleanupError } = await adminClient
        .from("conversation_artifacts")
        .delete()
        .eq("user_id", authData.user.id);

      if (cleanupError) {
        return NextResponse.json(
          { ok: false, error: `save failed: ${cleanupError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
