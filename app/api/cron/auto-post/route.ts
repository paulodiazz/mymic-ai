import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToX } from "../../../../lib/social/x-publish";

export const runtime = "nodejs";

type Day = { day: number; post: string; images?: string[] };
type ConversationArtifact = {
  id: string;
  sourceTitle?: string;
  actionCredentialMode?: "owner" | "product";
  xToken?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
  plan?: Day[];
  day?: number;
  posted?: number[];
  postedTweetIds?: string[];
  campaignId?: string;
  updatedAt?: string;
};
type BotProfile = {
  id: string;
  name: string;
  actionCredentialMode?: "owner" | "product";
  xToken?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
  plan?: Day[];
  day?: number;
  posted?: number[];
  postedTweetIds?: string[];
  campaignId?: string;
  conversationArtifacts?: ConversationArtifact[];
};
type AppState = {
  autoPost?: boolean;
  bots?: BotProfile[];
  activeBotId?: string | null;
  conversationArtifacts?: ConversationArtifact[];
  ownerXToken?: string;
  ownerXApiKey?: string;
  ownerXApiSecret?: string;
  ownerXAccessToken?: string;
  ownerXAccessTokenSecret?: string;
  campaignId?: string;
};

function cleanPostText(text: string): string {
  return text.replace(/^\s*\[tone:[^\]]+\]\s*/i, "").trim();
}

function pickNextUnpostedDay(plan: Day[], posted: number[]): Day | null {
  for (const item of plan) {
    if (!posted.includes(item.day)) return item;
  }
  return null;
}

function sortArtifacts(artifacts: ConversationArtifact[]): ConversationArtifact[] {
  return [...artifacts].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function hasXAuth(auth: {
  xToken?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
}): boolean {
  const hasBearer = Boolean(auth.xToken);
  const hasOauth1 = Boolean(
    auth.xApiKey && auth.xApiSecret && auth.xAccessToken && auth.xAccessTokenSecret
  );
  return hasBearer || hasOauth1;
}

async function handler(req: NextRequest) {
  const secretHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = secretHeader || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "missing supabase service credentials" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("user_app_state")
    .select("user_id, state");

  if (error) {
    return NextResponse.json({ ok: false, error: "failed to load state" }, { status: 500 });
  }

  const summary = {
    usersScanned: data?.length ?? 0,
    botsScanned: 0,
    postsAttempted: 0,
    postsSucceeded: 0,
    postsFailed: 0,
    usersUpdated: 0,
  };

  for (const row of data ?? []) {
    const state = (row.state ?? {}) as AppState;
    if (state.autoPost === false) continue;

    const bots = Array.isArray(state.bots) ? state.bots : [];
    if (!bots.length) continue;

    let updated = false;
    const updatedBots = [...bots];

    for (let idx = 0; idx < bots.length; idx += 1) {
      const bot = bots[idx];
      summary.botsScanned += 1;
      const artifacts = Array.isArray(bot.conversationArtifacts)
        ? sortArtifacts(bot.conversationArtifacts)
        : [];
      if (!artifacts.length) continue;

      const updatedArtifacts = [...artifacts];
      let artifactsUpdated = false;

      for (let aIdx = 0; aIdx < artifacts.length; aIdx += 1) {
        const artifact = artifacts[aIdx];
        const plan = Array.isArray(artifact.plan) ? artifact.plan : [];
        if (!plan.length) continue;
        const posted = Array.isArray(artifact.posted) ? artifact.posted : [];
        const nextItem = pickNextUnpostedDay(plan, posted);
        if (!nextItem) continue;

        const postText = cleanPostText(nextItem.post || "");
        if (!postText) continue;

        const mode = artifact.actionCredentialMode ?? bot.actionCredentialMode ?? "owner";
        const auth =
          mode === "owner"
            ? {
                xToken: state.ownerXToken ?? "",
                xApiKey: state.ownerXApiKey ?? "",
                xApiSecret: state.ownerXApiSecret ?? "",
                xAccessToken: state.ownerXAccessToken ?? "",
                xAccessTokenSecret: state.ownerXAccessTokenSecret ?? "",
              }
            : {
                xToken: artifact.xToken ?? bot.xToken ?? "",
                xApiKey: artifact.xApiKey ?? bot.xApiKey ?? "",
                xApiSecret: artifact.xApiSecret ?? bot.xApiSecret ?? "",
                xAccessToken: artifact.xAccessToken ?? bot.xAccessToken ?? "",
                xAccessTokenSecret: artifact.xAccessTokenSecret ?? bot.xAccessTokenSecret ?? "",
              };

        if (!hasXAuth(auth)) continue;

        summary.postsAttempted += 1;
      const result = await publishToX(
        postText,
        { campaignId: artifact.campaignId || bot.campaignId || state.campaignId || "camp", day: nextItem.day },
        auth,
        nextItem.images ?? [],
        { allowDuplicateSuffix: false }
      );

        if (!result.ok) {
          summary.postsFailed += 1;
          continue;
        }

        summary.postsSucceeded += 1;
        const nextPosted = posted.includes(nextItem.day)
          ? posted
          : [...posted, nextItem.day].sort((a, b) => a - b);
        const nextIds = result.postId
          ? Array.from(new Set([...(artifact.postedTweetIds ?? []), result.postId]))
          : artifact.postedTweetIds ?? [];

        updatedArtifacts[aIdx] = {
          ...artifact,
          posted: nextPosted,
          postedTweetIds: nextIds,
          day: Math.min(plan.length, nextItem.day + 1),
        };
        artifactsUpdated = true;
      }

      if (artifactsUpdated) {
        updatedBots[idx] = {
          ...bot,
          conversationArtifacts: updatedArtifacts,
        };
        updated = true;
        if (state.activeBotId && state.activeBotId === bot.id) {
          state.conversationArtifacts = updatedArtifacts;
        }
      }
    }

    if (updated) {
      summary.usersUpdated += 1;
      await supabase
        .from("user_app_state")
        .update({ state: { ...state, bots: updatedBots } })
        .eq("user_id", row.user_id);
    }
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
