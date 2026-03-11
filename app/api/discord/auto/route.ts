import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scanDiscord } from "@/lib/discord/scan";
import { generateReplyDraft } from "@/lib/discord/reply";

export const runtime = "nodejs";

type StoredState = Record<string, unknown>;

function getMessagesSinceCheckpoint(
  messages: Array<{ id: string; author: string; text: string }>,
  capturedUntilMessageId: string,
): Array<{ id: string; author: string; text: string }> {
  const safe = messages.filter((m) => Boolean(m.text?.trim()));
  if (!capturedUntilMessageId) return safe;
  const idx = safe.findIndex((m) => m.id === capturedUntilMessageId);
  if (idx < 0) return safe;
  return safe.slice(idx + 1);
}

async function postDiscordReply(input: {
  botToken: string;
  channelId: string;
  sourceMessageId: string;
  replyText: string;
}): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`https://discord.com/api/v10/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${input.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.replyText.slice(0, 1800),
      message_reference: { message_id: input.sourceMessageId },
      allowed_mentions: { parse: [] },
    }),
  });

  if (!r.ok) {
    let detail = "";
    try {
      const j = (await r.json()) as { message?: string };
      detail = j.message ? ` ${j.message}` : "";
    } catch {
      detail = "";
    }
    const hint =
      r.status === 401
        ? " check your bot token (paste only the token value, no 'bot ' prefix) and confirm it is still valid."
        : r.status === 403
          ? " missing access. grant the bot permission in this channel: view channel, read message history, send messages, and create public threads."
          : "";
    return { ok: false, error: `discord approve post failed (${r.status})${detail}${hint}` };
  }

  return { ok: true };
}

function loadString(state: StoredState, key: string): string {
  const value = state[key];
  return typeof value === "string" ? value.trim() : "";
}

function loadStringArray(state: StoredState, key: string): string[] {
  const value = state[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function loadLearningLog(state: StoredState): Array<{ at: string; sourceMessageId: string; notes: string[] }> {
  const value = state.discordLearningLog;
  return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item) : [];
}

export async function POST(req: NextRequest) {
  try {
    const secret = (process.env.DISCORD_AUTO_SECRET ?? "").trim();
    if (secret) {
      const provided = req.headers.get("x-discord-auto-secret")?.trim() ?? "";
      if (provided !== secret) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    const botToken = (process.env.DISCORD_BOT_TOKEN ?? "").trim();
    const openaiApiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    const ownerUserId = (process.env.DISCORD_OWNER_USER_ID ?? "").trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!botToken || !openaiApiKey || !ownerUserId || !supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "missing automation configuration" },
        { status: 500 },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await adminClient
      .from("user_app_state")
      .select("state")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { ok: false, error: `load failed: ${error.message}` },
        { status: 500 },
      );
    }

    const state = (data?.state ?? {}) as StoredState;
    const channelName =
      (process.env.DISCORD_CHANNEL_NAME ?? "").trim() || loadString(state, "discordChannelName") || "i-shipped";
    const channelId =
      (process.env.DISCORD_CHANNEL_ID ?? "").trim() || loadString(state, "discordChannelId");
    const inviteUrl =
      (process.env.DISCORD_INVITE_URL ?? "").trim() || loadString(state, "discordInviteUrl");
    const seenMessageIds = loadStringArray(state, "discordSeenMessageIds");

    const scan = await scanDiscord({
      botToken,
      inviteUrl,
      channelName,
      channelId,
      seenMessageIds,
    });

    const maxPostsRaw = Number.parseInt(process.env.DISCORD_AUTO_MAX_POSTS ?? "3", 10);
    const maxPosts = Number.isFinite(maxPostsRaw) && maxPostsRaw > 0 ? maxPostsRaw : 3;
    const targets = scan.drafts.filter(
      (draft) => draft.status === "needs_reply" || draft.status === "needs_followup",
    );

    const postedIds: string[] = [];
    const learningLog = loadLearningLog(state);
    const results: Array<{ draftId: string; ok: boolean; error?: string }> = [];
    for (const draft of targets.slice(0, maxPosts)) {
      const messagesSinceCheckpoint = getMessagesSinceCheckpoint(draft.threadMessages ?? [], "");
      const generated = await generateReplyDraft({
        openaiApiKey,
        toneProfile: loadString(state, "toneProfile") || "direct creator",
        artifactContext: {
          productName: "",
          productType: "",
          audience: "",
          intent: "",
          summary: "",
        },
        messagesSinceCheckpoint,
        sourceText: draft.sourceText,
        sourceAuthor: draft.sourceAuthor || "unknown",
        mode: draft.mode ?? "first_reply",
      });

      const res = await postDiscordReply({
        botToken,
        channelId: draft.sourceChannelId || channelId,
        sourceMessageId: draft.sourceMessageId,
        replyText: generated.replyText,
      });

      if (res.ok) {
        postedIds.push(draft.sourceMessageId);
        learningLog.unshift({
          at: new Date().toISOString(),
          sourceMessageId: draft.sourceMessageId,
          notes: generated.learning ?? [],
        });
      }
      results.push({ draftId: draft.draftId, ok: res.ok, error: res.error });
    }

    const nextSeen = Array.from(new Set([...seenMessageIds, ...postedIds])).slice(-500);
    const nextLearning = learningLog.slice(0, 120);
    const nextState = {
      ...state,
      discordSeenMessageIds: nextSeen,
      discordLearningLog: nextLearning,
    };

    const { error: saveError } = await adminClient
      .from("user_app_state")
      .upsert({ user_id: ownerUserId, state: nextState }, { onConflict: "user_id" });
    if (saveError) {
      return NextResponse.json(
        { ok: false, error: `save failed: ${saveError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      scanned: scan.stats,
      posted: postedIds.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord auto failed";
    if (message.includes("discord request failed (429)")) {
      return NextResponse.json(
        { ok: true, rateLimited: true, warning: "discord rate-limited the scan. retry later." },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
