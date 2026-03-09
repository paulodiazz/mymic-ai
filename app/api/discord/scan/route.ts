import { NextRequest, NextResponse } from "next/server";

type Body = {
  botToken?: string;
  inviteUrl?: string;
  channelName?: string;
  channelId?: string;
  openaiApiKey?: string;
  productName?: string;
  audience?: string;
  seenMessageIds?: string[];
};

type DiscordMessage = {
  id: string;
  content: string;
  channel_id?: string;
  attachments?: Array<{ id?: string; filename?: string; url?: string }>;
  embeds?: Array<{ type?: string; title?: string; description?: string; url?: string }>;
  author?: { id?: string; username?: string; bot?: boolean };
  message_reference?: { message_id?: string };
};

type Draft = {
  draftId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceTitle: string;
  sourceAuthor: string;
  sourceText: string;
  replyText: string;
  learning: string[];
  status: "needs_reply" | "active";
  mode: "first_reply" | "thread_followup";
};

type ScanStats = {
  threadCount: number;
  messageCount: number;
  postCount: number;
};

type DiscordChannel = {
  id: string;
  name?: string;
  type?: number;
  guild_id?: string;
  parent_id?: string;
  message_count?: number;
  thread_metadata?: { create_timestamp?: string };
};

type ResolvedChannel = {
  channelId: string;
  channelName: string;
  channelType: number;
  scanChannels: Array<{ id: string; title: string }>;
};

function sortNewestFirst(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    try {
      const ai = BigInt(a);
      const bi = BigInt(b);
      if (ai === bi) return 0;
      return ai > bi ? -1 : 1;
    } catch {
      return 0;
    }
  });
}

function parseInviteCode(inviteUrl: string): string {
  const cleaned = inviteUrl.trim();
  const m = cleaned.match(/discord\.gg\/([A-Za-z0-9-]+)/i);
  if (m?.[1]) return m[1];
  const m2 = cleaned.match(/discord\.com\/invite\/([A-Za-z0-9-]+)/i);
  return m2?.[1] ?? cleaned;
}

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

function extractMessageText(msg: DiscordMessage): string {
  const plain = msg.content?.trim();
  if (plain) return plain;

  const embedBits = (msg.embeds ?? [])
    .flatMap((e) => [e.title, e.description, e.url])
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  if (embedBits.length > 0) return embedBits.join(" | ").slice(0, 500);

  const attachmentBits = (msg.attachments ?? [])
    .flatMap((a) => [a.filename, a.url])
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  if (attachmentBits.length > 0) return attachmentBits.join(" | ").slice(0, 500);

  return "no text content";
}

function isMissingText(msg: DiscordMessage | null | undefined): boolean {
  if (!msg) return true;
  const plain = msg.content?.trim();
  const hasEmbedText = (msg.embeds ?? []).some(
    (e) => Boolean(e.title?.trim()) || Boolean(e.description?.trim()) || Boolean(e.url?.trim()),
  );
  const hasAttachmentText = (msg.attachments ?? []).some(
    (a) => Boolean(a.filename?.trim()) || Boolean(a.url?.trim()),
  );
  return !plain && !hasEmbedText && !hasAttachmentText;
}

async function discordGet<T>(url: string, botToken: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bot ${botToken}` },
      cache: "no-store",
    });

    if (r.ok) {
      return (await r.json()) as T;
    }

    let detail = "";
    let retryMs = 0;
    try {
      const json = (await r.json()) as { message?: string; retry_after?: number };
      detail = json.message ? ` ${json.message}` : "";
      if (typeof json.retry_after === "number" && Number.isFinite(json.retry_after)) {
        retryMs = Math.max(500, Math.ceil(json.retry_after * 1000));
      }
    } catch {
      detail = "";
    }

    if (retryMs === 0) {
      const retryAfterHeader = r.headers.get("retry-after");
      const resetAfterHeader = r.headers.get("x-ratelimit-reset-after");
      const parsedRetryAfter = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN;
      const parsedResetAfter = resetAfterHeader ? Number.parseFloat(resetAfterHeader) : NaN;
      if (Number.isFinite(parsedRetryAfter)) {
        retryMs = Math.max(500, Math.ceil(parsedRetryAfter * 1000));
      } else if (Number.isFinite(parsedResetAfter)) {
        retryMs = Math.max(500, Math.ceil(parsedResetAfter * 1000));
      }
    }

    if (r.status === 429 && attempt < 4) {
      const delay = retryMs > 0 ? retryMs : 1000 + attempt * 600;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const hint =
      r.status === 401
        ? " check your bot token (paste only the token value, no 'bot ' prefix) and confirm it is still valid."
        : r.status === 403
          ? " missing access. invite the bot to the server and grant channel permissions: view channel, read message history, send messages, and create public threads."
          : r.status === 429
            ? " discord rate-limited the scan. wait a few seconds and retry."
            : "";
    throw new Error(`discord request failed (${r.status})${detail}${hint}`);
  }
  throw new Error("discord request failed (429) discord rate-limited the scan. wait a few seconds and retry.");
}

async function resolveChannel(input: {
  botToken: string;
  inviteUrl?: string;
  channelName: string;
  channelId?: string;
}): Promise<ResolvedChannel> {
  const loadForumThreads = async (
    forumChannelId: string,
    guildId: string,
  ): Promise<Array<{ id: string; title: string }>> => {
    const active = await discordGet<{ threads?: DiscordChannel[] }>(
      `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
      input.botToken,
    );
    const threads = (active.threads ?? []).filter(
      (t) => t.parent_id === forumChannelId && Boolean(t.id),
    );
    if (threads.length === 0) {
      throw new Error("forum channel has no visible threads yet");
    }
    const sortedIds = sortNewestFirst(threads.map((t) => t.id));
    return sortedIds
      .slice(0, 3)
      .map((id) => {
        const thread = threads.find((t) => t.id === id);
        return { id, title: thread?.name?.trim() || "untitled thread" };
      });
  };

  if (input.channelId?.trim()) {
    const ch = await discordGet<DiscordChannel>(
      `https://discord.com/api/v10/channels/${input.channelId.trim()}`,
      input.botToken,
    );
    const channelType = ch.type ?? 0;
    if (channelType === 15) {
      const guildId = ch.guild_id?.trim();
      if (!guildId) {
        throw new Error("could not resolve guild for forum channel");
      }
      return {
        channelId: ch.id,
        channelName: ch.name ?? input.channelName,
        channelType,
        scanChannels: await loadForumThreads(ch.id, guildId),
      };
    }
    return {
      channelId: ch.id,
      channelName: ch.name ?? input.channelName,
      channelType,
      scanChannels: [{ id: ch.id, title: ch.name?.trim() || input.channelName || "channel" }],
    };
  }

  if (!input.inviteUrl?.trim()) {
    throw new Error("missing discord invite url");
  }

  const code = parseInviteCode(input.inviteUrl);
  const invite = await discordGet<{
    guild?: { id?: string };
    channel?: { id?: string; name?: string };
  }>(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, input.botToken);

  const guildId = invite.guild?.id;
  if (!guildId) {
    if (invite.channel?.id) {
      const channelId = invite.channel.id;
      const ch = await discordGet<DiscordChannel>(
        `https://discord.com/api/v10/channels/${channelId}`,
        input.botToken,
      );
      const channelType = ch.type ?? 0;
      if (channelType === 15) {
        const resolvedGuildId = ch.guild_id?.trim();
        if (!resolvedGuildId) {
          throw new Error("could not resolve guild for forum channel");
        }
        return {
          channelId,
          channelName: ch.name ?? invite.channel?.name ?? input.channelName,
          channelType,
          scanChannels: await loadForumThreads(channelId, resolvedGuildId),
        };
      }
      return {
        channelId,
        channelName: ch.name ?? invite.channel?.name ?? input.channelName,
        channelType,
        scanChannels: [
          { id: channelId, title: ch.name?.trim() || invite.channel?.name?.trim() || "channel" },
        ],
      };
    }
    throw new Error("could not resolve guild from invite");
  }

  const channels = await discordGet<DiscordChannel[]>(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    input.botToken,
  );
  const wanted = input.channelName.trim().toLowerCase();
  const found = channels.find(
    (c) =>
      (c.type === 0 || c.type === 5 || c.type === 11 || c.type === 12 || c.type === 15) &&
      (c.name ?? "").toLowerCase() === wanted,
  );
  if (!found) {
    throw new Error(`could not find channel "${input.channelName}" in guild`);
  }
  const channelType = found.type ?? 0;
  if (channelType === 15) {
    return {
      channelId: found.id,
      channelName: found.name ?? input.channelName,
      channelType,
      scanChannels: await loadForumThreads(found.id, guildId),
    };
  }
  return {
    channelId: found.id,
    channelName: found.name ?? input.channelName,
    channelType,
    scanChannels: [{ id: found.id, title: found.name?.trim() || input.channelName || "channel" }],
  };
}

async function generateWithGpt(
  openaiApiKey: string,
  prompt: string,
  system: string,
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("missing openai api key for discord reply generation");
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    let detail = "";
    try {
      const err = (await r.json()) as { error?: { message?: string } };
      detail = err.error?.message ? ` ${err.error.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`openai reply generation failed (${r.status})${detail}`);
  }
  const d = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = d.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("openai reply generation returned empty content");
  }
  return content;
}

async function draftReply(input: {
  openaiApiKey: string;
  productName: string;
  audience: string;
  sourceText: string;
  sourceAuthor: string;
  mode: "first_reply" | "thread_followup";
}): Promise<{ replyText: string; learning: string[] }> {
  const system =
    "you are a helpful bot. voice: humble, new, curious, always learning. keep replies short and human.";
  const prompt = `
write one discord reply.
rules:
- 1-3 sentences
- mention that you are new and learning from feedback
- offer to help visibility for their product
- no spam, no links, no hashtags
- stay specific to their message

mode: ${input.mode}
product: ${input.productName}
audience: ${input.audience}
author: ${input.sourceAuthor}
message:
${input.sourceText}

after the reply, add a separator line "###LEARNING###" and then 2 short bullet points with what the bot learned from this message.
`;

  const raw = await generateWithGpt(input.openaiApiKey, prompt, system);
  const [replyPart, learningPart] = raw.split("###LEARNING###");
  const learning = (learningPart ?? "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    replyText: (replyPart ?? raw).trim().slice(0, 600),
    learning,
  };
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
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";
    const productName = body.productName?.trim() || "my project";
    const audience = body.audience?.trim() || "builders";
    if (!botToken) {
      return NextResponse.json({ ok: false, error: "missing discord bot token" }, { status: 400 });
    }

    const channel = await resolveChannel({
      botToken,
      inviteUrl: body.inviteUrl,
      channelName,
      channelId: body.channelId,
    });

    const me = await discordGet<{ id: string; username?: string }>(
      "https://discord.com/api/v10/users/@me",
      botToken,
    );
    const drafts: Draft[] = [];
    const stats: ScanStats = { threadCount: 0, messageCount: 0, postCount: 0 };
    for (const scanChannel of channel.scanChannels) {
      stats.threadCount += 1;
      const messages = await discordGet<DiscordMessage[]>(
        `https://discord.com/api/v10/channels/${scanChannel.id}/messages?limit=50`,
        botToken,
      );
      stats.messageCount += messages.length;
      const threadMeta = await discordGet<DiscordChannel>(
        `https://discord.com/api/v10/channels/${scanChannel.id}`,
        botToken,
      );
      let starterById: DiscordMessage | null = null;
      try {
        starterById = await discordGet<DiscordMessage>(
          `https://discord.com/api/v10/channels/${scanChannel.id}/messages/${scanChannel.id}`,
          botToken,
        );
      } catch {
        starterById = null;
      }

      const threadMessages = [...messages].reverse();
      // For forum posts, the thread id usually equals the starter message id.
      // Prefer that exact message when present to avoid ordering/collection quirks.
      const original =
        starterById ??
        threadMessages.find((m) => m.id === scanChannel.id) ??
        (threadMeta.id
          ? threadMessages.find((m) => m.id === threadMeta.id)
          : undefined) ??
        threadMessages[0];
      if (!original) continue;
      const body = isMissingText(original)
        ? "content hidden (enable message content intent in discord bot settings)"
        : extractMessageText(original);
      const comments = threadMessages
        .slice(1)
        .map((msg) => {
          const text = extractMessageText(msg);
          const author = msg.author?.username ?? "unknown";
          return `@${author}: ${text}`;
        })
        .filter(Boolean)
        .slice(0, 8);
      const hasBotComment = threadMessages.slice(1).some((msg) => msg.author?.id === me.id);

      const combinedText =
        comments.length > 0
          ? `${body}\n\ncomments:\n${comments.map((c) => `- ${c}`).join("\n")}`
          : `${body}\n\ncomments:\n- no comments yet`;
      const generated = hasBotComment
        ? { replyText: "", learning: [] }
        : await draftReply({
            openaiApiKey,
            productName,
            audience,
            sourceText: combinedText,
            sourceAuthor: original.author?.username ?? "unknown",
            mode: "first_reply",
          });

      drafts.push({
        draftId: `${scanChannel.id}:thread`,
        sourceMessageId: original.id,
        sourceChannelId: scanChannel.id,
        sourceTitle: scanChannel.title,
        sourceAuthor: original.author?.username ?? "unknown",
        sourceText: combinedText,
        replyText: generated.replyText,
        learning: generated.learning,
        status: hasBotComment ? "active" : "needs_reply",
        mode: "first_reply",
      });
      if (drafts.length >= 20) break;
    }
    stats.postCount = drafts.length;

    return NextResponse.json({
      ok: true,
      channelId: channel.channelId,
      channelName: channel.channelName,
      botUser: me.username ?? "bot",
      drafts: drafts.slice(0, 20),
      stats,
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
