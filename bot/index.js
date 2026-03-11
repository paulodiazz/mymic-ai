import http from "node:http";
import { Client, GatewayIntentBits, Partials } from "discord.js";

const required = (name) => {
  const value = process.env[name] ?? "";
  if (!value.trim()) {
    console.error(`[bot] missing ${name}`);
    process.exit(1);
  }
  return value.trim();
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .replace(/^bot\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();

const DISCORD_BOT_TOKEN = normalizeToken(required("DISCORD_BOT_TOKEN"));
const DISCORD_CHANNEL_ID = required("DISCORD_CHANNEL_ID");
const OPENAI_API_KEY = required("OPENAI_API_KEY");

const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
const OPENAI_TEMPERATURE = Number.parseFloat(process.env.OPENAI_TEMPERATURE || "0.5");
const REPLY_COOLDOWN_MS = Number.parseInt(process.env.REPLY_COOLDOWN_MS || "1500", 10);
const INCLUDE_THREADS = (process.env.INCLUDE_THREADS || "false").toLowerCase() === "true";
const TONE_PROFILE = (process.env.TONE_PROFILE || "direct creator").trim();

const SYSTEM_PROMPT = (process.env.BOT_SYSTEM_PROMPT ||
  "you are a helpful bot. voice: humble, new, curious, always learning. keep replies short and human.").trim();

const normalizeText = (text) => String(text || "").replace(/\s+/g, " ").replace(/\u0000/g, "").trim();

const extractMessageText = (msg) => {
  const plain = normalizeText(msg?.content || "");
  if (plain) return plain;
  const embedText = (msg?.embeds || [])
    .flatMap((e) => [e?.title, e?.description, e?.url])
    .map((v) => normalizeText(v))
    .filter(Boolean);
  if (embedText.length) return embedText.join(" | ").slice(0, 500);
  const attachText = Array.from(msg?.attachments?.values?.() || [])
    .flatMap((a) => [a?.name, a?.url])
    .map((v) => normalizeText(v))
    .filter(Boolean);
  if (attachText.length) return attachText.join(" | ").slice(0, 500);
  return "no text content";
};

const getMessagesSinceCheckpoint = (messages, capturedUntilMessageId) => {
  const safe = messages.filter((m) => normalizeText(m.text));
  if (!capturedUntilMessageId) return safe;
  const idx = safe.findIndex((m) => m.id === capturedUntilMessageId);
  if (idx < 0) return safe;
  return safe.slice(idx + 1);
};

const extractRelatedToPhrase = (text) => {
  const match = text.match(/related to\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  return match.trim();
};

const cleanProductName = (text) =>
  normalizeText(text)
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/^[\-\u2013\u2014:]+/, "")
    .replace(/\s+[\-:]\s+.*$/, "")
    .trim();

const inferProductType = (text) => {
  const lower = text.toLowerCase();
  if (/(app|saas|tool|platform|software)\b/.test(lower)) return "software";
  if (/(agency|studio|consulting|consultant)\b/.test(lower)) return "consulting";
  if (/(newsletter|content|blog|media)\b/.test(lower)) return "media";
  if (/(course|cohort|training|workshop)\b/.test(lower)) return "education";
  if (/(community|discord|forum|group)\b/.test(lower)) return "community";
  return "";
};

const inferProductNameFromBody = (raw) => {
  const body = normalizeText(raw);
  const buildMatch = body.match(/(?:building|built|shipping)\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  if (buildMatch) return cleanProductName(buildMatch);
  const productMatch =
    body.match(/(?:product|project)\s+(?:is|:)\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  if (productMatch) return cleanProductName(productMatch);
  const related = extractRelatedToPhrase(body);
  if (related) return cleanProductName(related);
  return "";
};

const inferAudience = (text) => {
  const lower = text.toLowerCase();
  const explicit =
    lower.match(/audience\s+(?:is\s+)?(?:mainly\s+|mostly\s+)?([a-z0-9\s,&-]{3,120})/i)?.[1] ??
    "";
  if (explicit.trim()) return explicit.trim().replace(/\s+/g, " ");
  const target = lower.match(/(?:target|for)\s+([a-z0-9\s,&-]{3,120})/i)?.[1] ?? "";
  if (target.trim()) return target.trim().replace(/\s+/g, " ");
  if (lower.includes("founder")) return "founders";
  if (lower.includes("creator")) return "creators";
  if (lower.includes("developer") || lower.includes("dev")) return "developers";
  return "";
};

const inferIntent = (text) => {
  const lower = text.toLowerCase();
  if (
    lower.includes("how do you think you could help") ||
    lower.includes("how could you help") ||
    lower.includes("increase visibility")
  ) {
    return "wants help increasing visibility";
  }
  if (lower.includes("marketing")) return "improve visibility and marketing";
  if (lower.includes("feedback")) return "wants feedback";
  if (lower.includes("looking for")) return "looking for users";
  if (lower.includes("ship")) return "shipping update";
  return "";
};

const summarizeThreadMessages = (messages, maxChars = 1200) => {
  const safe = messages.filter((m) => normalizeText(m.text));
  if (!safe.length) return "";
  const authors = Array.from(
    new Set(safe.map((m) => (m.author || "unknown").trim()).filter(Boolean)),
  );
  const splitSentences = (text) =>
    normalizeText(text)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const questions = [];
  const goals = [];
  const constraints = [];
  const facts = [];

  safe.forEach((m, idx) => {
    const sentences = splitSentences(m.text || "");
    if (!sentences.length) return;
    const firstSentence = sentences[0];
    if (idx < 2 && firstSentence) facts.push(firstSentence);
    for (const s of sentences) {
      const lower = s.toLowerCase();
      if (s.includes("?") || /^(how|what|why|when|where|should|can|could|would|do)\b/.test(lower)) {
        questions.push(s);
        continue;
      }
      if (
        /(i|we)\s+(need|want|looking for|hope|plan|are trying|are aiming)|\b(goal|objective|priority)\b/.test(
          lower,
        )
      ) {
        goals.push(s);
        continue;
      }
      if (/\b(can't|cannot|must|should|avoid|don't|do not|no\s+|won't)\b/.test(lower)) {
        constraints.push(s);
      }
    }
  });

  const last = safe[safe.length - 1];
  const latest = last?.text ? normalizeText(last.text) : "";

  const uniq = (arr) => Array.from(new Set(arr.map((s) => normalizeText(s))).values());
  const pick = (arr, limit) => uniq(arr).slice(0, limit);

  const parts = [
    authors.length ? `participants: ${authors.join(", ")}.` : "",
    facts.length ? `thread gist: ${pick(facts, 2).join(" ")}` : "",
    goals.length ? `goals: ${pick(goals, 2).join(" ")}` : "",
    constraints.length ? `constraints: ${pick(constraints, 2).join(" ")}` : "",
    questions.length ? `open questions: ${pick(questions, 2).join(" ")}` : "",
    latest ? `latest message: ${latest}` : "",
  ].filter(Boolean);

  const summary = parts.join(" ");
  if (summary.length <= maxChars) return summary;
  return `${summary.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
};

const buildCondensedContextFromMessages = (messages) => {
  const safe = messages.filter((m) => normalizeText(m.text));
  const rawBody = safe.map((m) => m.text).join(" ");
  const body = rawBody.toLowerCase();
  const product = inferProductNameFromBody(rawBody);
  const audience = inferAudience(body);
  const intent = inferIntent(body);
  const productType = inferProductType(body);
  const engaged = body.includes("interested") || body.includes("okay");
  const snippet = summarizeThreadMessages(safe, 1400);
  const summary = [
    engaged ? "customer engaged positively and continued the thread." : "",
    product ? `product topic: ${product}.` : "",
    productType ? `product type: ${productType}.` : "",
    audience ? `audience: ${audience}.` : "",
    intent ? `intent: ${intent}.` : "",
    snippet ? `thread summary: ${snippet}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);
  const last = safe[safe.length - 1];
  return {
    summary,
    capturedUntilMessageId: last?.id ?? "",
    capturedMessageCount: safe.length,
    lastMessage: last?.text ?? "",
    productName: product,
    productType,
    audience,
    intent,
  };
};

const USER_PROMPT = (input) => `
COMMENT RULES
=============

VOICE
- You are a new account, early and honest about it. Mention this naturally — not as a disclaimer,
  but as a reason why feedback and real conversations matter to you right now.
- Write like a sharp human, not a brand. Fast, specific, warm but not sycophantic.
- One clear thought per comment. Do not try to say everything.

STRUCTURE
- 1 to 3 sentences maximum.
- Lead with the most interesting thing you have to say, not with agreement.
- If you want to offer visibility help, earn it first with a genuine observation about
  their specific message, then offer naturally. Never lead with the offer.

SPECIFICITY
- Stay anchored to what they actually said. Mirror their specific words, situation, or problem.
- Never invent product names, audiences, brands, or details not present in their message.
- If product context is missing, say "your project" or "what you are building" — never guess.
- Prioritize the most recent message if multiple messages exist.

WHAT TO AVOID
- No links, no hashtags, no calls to action that feel transactional.
- No generic openers: "Great point", "Love this", "So true", "This is amazing."
- No repeating the previous bot reply if one exists.
  If a prior reply was sent, the new comment must open differently and add something new.
  Prior reply to avoid repeating: ${input.lastBotReply ? `"${input.lastBotReply}"` : "none"}

VISIBILITY OFFER
- The offer to help with visibility should feel like a natural next step, not a pitch.
- Only include it if the comment has already delivered real value in the lines before it.
- Frame it as mutual: you are also learning from their audience and context.

OUTCOME TO OPTIMIZE FOR
- The reader should feel genuinely seen and want to reply.
- A comment that gets a reply beats a comment that gets a like.
- If you cannot add something specific and real, say less — not more.

tone_profile:
${input.toneProfile}

mode: ${input.mode}
author: ${input.sourceAuthor}
artifact_context:
- product_name: ${input.artifactContext.productName || "unknown"}
- product_type: ${input.artifactContext.productType || "unknown"}
- audience: ${input.artifactContext.audience || "unknown"}
- intent: ${input.artifactContext.intent || "unknown"}
- condensed_context: ${input.artifactContext.summary || "unknown"}

enumerated_messages_since_checkpoint:
${input.messagesSinceCheckpoint.map((msg, idx) => `#${idx + 1} [${msg.id}] @${msg.author}: ${msg.text}`).join("\n") || "none"}

latest_thread_snapshot:
${input.sourceText}

after the reply, add a separator line "###LEARNING###" and then 2 short bullet points with what the bot learned from this message.
`;

async function generateReply(input) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: Number.isFinite(OPENAI_TEMPERATURE) ? OPENAI_TEMPERATURE : 0.5,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT(input) },
      ],
    }),
  });

  if (!r.ok) {
    let detail = "";
    try {
      const err = await r.json();
      detail = err?.error?.message ? ` ${err.error.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`openai reply failed (${r.status})${detail}`);
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  const [replyPart, learningPart] = content.split("###LEARNING###");
  const learning = (learningPart || "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const replyText = (replyPart || content).trim().slice(0, 600);
  return { replyText, learning };
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

let lastReplyAt = 0;

client.on("error", (error) => {
  console.error("[bot] client error", error);
});
client.on("shardError", (error) => {
  console.error("[bot] shard error", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[bot] unhandled rejection", reason);
});

client.on("ready", () => {
  console.log(`[bot] logged in as ${client.user?.tag || "unknown"}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message || message.author?.bot) return;
    const isThread = message.channel?.isThread?.();
    if (!INCLUDE_THREADS && isThread) return;
    if (message.channelId !== DISCORD_CHANNEL_ID) {
      const parentId = isThread ? message.channel?.parentId : null;
      if (!parentId || parentId !== DISCORD_CHANNEL_ID) return;
    }

    const text = normalizeText(message.content || "");
    if (!text) return;

    const now = Date.now();
    if (REPLY_COOLDOWN_MS > 0 && now - lastReplyAt < REPLY_COOLDOWN_MS) return;
    lastReplyAt = now;

    await message.channel.sendTyping();
    const fetched = await message.channel.messages.fetch({ limit: 40 });
    const ordered = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const threadMessages = ordered.map((msg) => ({
      id: msg.id,
      author: msg.author?.username || "unknown",
      text: extractMessageText(msg),
      mine: Boolean(client.user?.id && msg.author?.id === client.user?.id),
    }));
    const lastBotReply = [...threadMessages].reverse().find((m) => m.mine)?.text || "";
    const condensed = buildCondensedContextFromMessages(threadMessages);
    const messagesSinceCheckpoint = getMessagesSinceCheckpoint(
      threadMessages,
      threadMessages.find((m) => m.mine)?.id || "",
    );

    const generated = await generateReply({
      toneProfile: TONE_PROFILE,
      mode: threadMessages.some((m) => m.mine) ? "thread_followup" : "first_reply",
      sourceAuthor: message.author?.username || "unknown",
      sourceText: threadMessages.map((m) => `@${m.author}: ${m.text}`).join("\n"),
      artifactContext: {
        productName: condensed.productName,
        productType: condensed.productType,
        audience: condensed.audience,
        intent: condensed.intent,
        summary: condensed.summary,
      },
      messagesSinceCheckpoint,
      lastBotReply,
    });

    if (!generated?.replyText) return;

    await message.reply({
      content: generated.replyText,
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    console.error("[bot] reply failed", error);
  }
});

const port = Number.parseInt(process.env.PORT || "3000", 10);
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("bot running");
});

server.listen(port, () => {
  console.log(`[bot] http server on ${port}`);
});

client.login(DISCORD_BOT_TOKEN).catch((error) => {
  console.error("[bot] login failed", error);
  process.exit(1);
});
