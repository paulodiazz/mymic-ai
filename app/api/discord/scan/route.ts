import { NextRequest, NextResponse } from "next/server";
import { scanDiscord } from "@/lib/discord/scan";

type Body = {
  botToken?: string;
  inviteUrl?: string;
  channelName?: string;
  channelId?: string;
  seenMessageIds?: string[];
};

function normalizeDiscordBotToken(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/^bot\s+/i, "").trim();
}

function detectTokenMismatch(raw: string): string | null {
  const value = normalizeDiscordBotToken(raw);
  if (!value) return "missing discord bot token";
  if (/^\d{17,20}$/.test(value)) {
    return "this looks like a discord app id/client id, not a bot token. open your discord app > bot > reset token, then paste that token here.";
  }
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return "this looks like a discord public key, not a bot token. use the bot token from discord app > bot > reset token.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const tokenError = detectTokenMismatch(body.botToken ?? "");
    if (tokenError) {
      return NextResponse.json({ ok: false, error: tokenError }, { status: 400 });
    }
    const botToken = normalizeDiscordBotToken(body.botToken ?? "");
    const channelName = body.channelName?.trim() || "i-shipped";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "missing discord bot token" }, { status: 400 });
    }

    const result = await scanDiscord({
      botToken,
      inviteUrl: body.inviteUrl,
      channelName,
      channelId: body.channelId,
      seenMessageIds: body.seenMessageIds ?? [],
    });

    return NextResponse.json({
      ok: true,
      channelId: result.channelId,
      channelName: result.channelName,
      botUser: result.botUser,
      drafts: result.drafts,
      stats: result.stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord scan failed";
    if (message.includes("discord request failed (429)")) {
      return NextResponse.json(
        {
          ok: true,
          rateLimited: true,
          warning: "discord is rate-limiting scans right now. wait 20-30 seconds and run scan again.",
          drafts: [],
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
