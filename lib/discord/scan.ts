type ScanInput = {
  botToken: string;
  inviteUrl?: string;
  channelName?: string;
  channelId?: string;
  seenMessageIds?: string[];
};

export type DiscordDraft = {
  draftId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceTitle: string;
  sourceAuthor: string;
  sourceText: string;
  threadMessages: Array<{ id: string; author: string; text: string }>;
  lastConversationMessageId: string;
  replyText: string;
  learning: string[];
  status: "needs_reply" | "needs_followup" | "waiting";
  mode: "first_reply" | "thread_followup";
};

export type ScanStats = {
  threadCount: number;
  messageCount: number;
  postCount: number;
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

function isMessageFromBot(msg: DiscordMessage | undefined, me: { id: string; username?: string }): boolean {
  if (!msg?.author) return false;
  const authorId = msg.author.id?.trim();
  const meId = me.id?.trim();
  if (authorId && meId && authorId === meId) return true;

  const authorUsername = msg.author.username?.trim().toLowerCase();
  const meUsername = me.username?.trim().toLowerCase();
  if (authorUsername && meUsername && authorUsername === meUsername) return true;

  return false;
}

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

function compareSnowflakeAsc(a: string, b: string): number {
  try {
    const ai = BigInt(a);
    const bi = BigInt(b);
    if (ai === bi) return 0;
    return ai < bi ? -1 : 1;
  } catch {
    return 0;
  }
}

function parseInviteCode(inviteUrl: string): string {
  const cleaned = inviteUrl.trim();
  const m = cleaned.match(/discord\.gg\/([A-Za-z0-9-]+)/i);
  if (m?.[1]) return m[1];
  const m2 = cleaned.match(/discord\.com\/invite\/([A-Za-z0-9-]+)/i);
  return m2?.[1] ?? cleaned;
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

export async function scanDiscord(input: ScanInput): Promise<{
  channelId: string;
  channelName: string;
  botUser: string;
  drafts: DiscordDraft[];
  stats: ScanStats;
}> {
  const channelName = input.channelName?.trim() || "i-shipped";
  const channel = await resolveChannel({
    botToken: input.botToken,
    inviteUrl: input.inviteUrl,
    channelName,
    channelId: input.channelId,
  });

  const seenSet = new Set((input.seenMessageIds ?? []).filter(Boolean));
  const me = await discordGet<{ id: string; username?: string }>(
    "https://discord.com/api/v10/users/@me",
    input.botToken,
  );
  const drafts: DiscordDraft[] = [];
  const stats: ScanStats = { threadCount: 0, messageCount: 0, postCount: 0 };
  for (const scanChannel of channel.scanChannels) {
    stats.threadCount += 1;
    const messages = await discordGet<DiscordMessage[]>(
      `https://discord.com/api/v10/channels/${scanChannel.id}/messages?limit=50`,
      input.botToken,
    );
    stats.messageCount += messages.length;
    const threadMeta = await discordGet<DiscordChannel>(
      `https://discord.com/api/v10/channels/${scanChannel.id}`,
      input.botToken,
    );
    let starterById: DiscordMessage | null = null;
    try {
      starterById = await discordGet<DiscordMessage>(
        `https://discord.com/api/v10/channels/${scanChannel.id}/messages/${scanChannel.id}`,
        input.botToken,
      );
    } catch {
      starterById = null;
    }

    const threadMessages = [...messages].reverse();
    const original =
      starterById ??
      threadMessages.find((m) => m.id === scanChannel.id) ??
      (threadMeta.id ? threadMessages.find((m) => m.id === threadMeta.id) : undefined) ??
      threadMessages[0];
    if (!original) continue;
    const body = isMissingText(original)
      ? "content hidden (enable message content intent in discord bot settings)"
      : extractMessageText(original);
    const ordered = [...threadMessages].sort((a, b) => compareSnowflakeAsc(a.id, b.id));
    const comments = ordered
      .slice(1)
      .map((msg) => {
        const text = extractMessageText(msg);
        const author = msg.author?.username ?? "unknown";
        return `@${author}: ${text}`;
      })
      .filter(Boolean)
      .slice(-8);
    const hasBotComment = ordered.slice(1).some((msg) => isMessageFromBot(msg, me));
    const lastBotIndex = (() => {
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (isMessageFromBot(ordered[i], me)) return i;
      }
      return -1;
    })();
    const hasHumanAfterLastBot =
      lastBotIndex >= 0 &&
      ordered.slice(lastBotIndex + 1).some((msg) => !isMessageFromBot(msg, me));
    const status: DiscordDraft["status"] = !hasBotComment
      ? "needs_reply"
      : hasHumanAfterLastBot
        ? "needs_followup"
        : "waiting";
    const mode: DiscordDraft["mode"] = hasBotComment ? "thread_followup" : "first_reply";
    const latest = ordered[ordered.length - 1] ?? original;
    if (status === "waiting" && seenSet.has(latest.id)) continue;

    const replyTargetId = latest.id;
    const threadPayload = ordered
      .map((msg) => ({
        id: msg.id,
        author: msg.author?.username ?? "unknown",
        text: extractMessageText(msg),
      }))
      .filter((msg) => Boolean(msg.text?.trim()))
      .slice(-20);

    const combinedText =
      comments.length > 0
        ? `${body}\n\ncomments:\n${comments.map((c) => `- ${c}`).join("\n")}`
        : `${body}\n\ncomments:\n- no comments yet`;
    drafts.push({
      draftId: `${scanChannel.id}:thread`,
      sourceMessageId: replyTargetId,
      sourceChannelId: scanChannel.id,
      sourceTitle: scanChannel.title,
      sourceAuthor: original.author?.username ?? "unknown",
      sourceText: combinedText,
      threadMessages: threadPayload,
      lastConversationMessageId: latest.id,
      replyText: "",
      learning: [],
      status,
      mode,
    });
    if (drafts.length >= 20) break;
  }
  stats.postCount = drafts.length;

  return {
    channelId: channel.channelId,
    channelName: channel.channelName,
    botUser: me.username ?? "bot",
    drafts: drafts.slice(0, 20),
    stats,
  };
}
