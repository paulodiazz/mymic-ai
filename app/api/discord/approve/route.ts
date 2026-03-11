import { NextRequest, NextResponse } from "next/server";

type Body = {
  botToken?: string;
  channelId?: string;
  sourceMessageId?: string;
  replyText?: string;
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
    const rawToken = body.botToken?.trim() || process.env.DISCORD_BOT_TOKEN || "";
    const tokenError = detectTokenMismatch(rawToken);
    if (tokenError) {
      return NextResponse.json({ ok: false, error: tokenError }, { status: 400 });
    }
    const botToken = normalizeDiscordBotToken(rawToken);
    const channelId = body.channelId?.trim() ?? "";
    const sourceMessageId = body.sourceMessageId?.trim() ?? "";
    const replyText = body.replyText?.trim() ?? "";

    if (!botToken || !channelId || !sourceMessageId || !replyText) {
      return NextResponse.json(
        { ok: false, error: "missing botToken, channelId, sourceMessageId, or replyText" },
        { status: 400 },
      );
    }

    const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: replyText.slice(0, 1800),
        message_reference: { message_id: sourceMessageId },
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
      return NextResponse.json(
        { ok: false, error: `discord approve post failed (${r.status})${detail}${hint}` },
        { status: 400 },
      );
    }

    const posted = (await r.json()) as { id?: string };
    return NextResponse.json({ ok: true, postedMessageId: posted.id ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "discord approve failed" }, { status: 500 });
  }
}
