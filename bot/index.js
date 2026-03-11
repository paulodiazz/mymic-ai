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

const DISCORD_BOT_TOKEN = required("DISCORD_BOT_TOKEN");
const DISCORD_CHANNEL_ID = required("DISCORD_CHANNEL_ID");
const OPENAI_API_KEY = required("OPENAI_API_KEY");

const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
const OPENAI_TEMPERATURE = Number.parseFloat(process.env.OPENAI_TEMPERATURE || "0.5");
const REPLY_COOLDOWN_MS = Number.parseInt(process.env.REPLY_COOLDOWN_MS || "1500", 10);
const INCLUDE_THREADS = (process.env.INCLUDE_THREADS || "false").toLowerCase() === "true";

const SYSTEM_PROMPT = (process.env.BOT_SYSTEM_PROMPT ||
  "you are a helpful bot. voice: humble, new, curious, always learning. keep replies short and human.").trim();

const USER_PROMPT = (messageText, author) => `
write one discord reply.
rules:
- 1-3 sentences
- mention that you are new and learning from feedback
- offer to help visibility for their product
- no spam, no links, no hashtags
- stay specific to their message
- if context is missing, say "your project" instead of guessing

author: ${author || "unknown"}
latest_message:
${messageText}
`;

async function generateReply(messageText, author) {
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
        { role: "user", content: USER_PROMPT(messageText, author) },
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
  const content = data?.choices?.[0]?.message?.content?.trim();
  return content ? content.slice(0, 600) : "";
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

let lastReplyAt = 0;

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

    const text = message.content?.trim();
    if (!text) return;

    const now = Date.now();
    if (REPLY_COOLDOWN_MS > 0 && now - lastReplyAt < REPLY_COOLDOWN_MS) return;
    lastReplyAt = now;

    await message.channel.sendTyping();
    const reply = await generateReply(text, message.author?.username || "unknown");
    if (!reply) return;

    await message.reply({
      content: reply,
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

client.login(DISCORD_BOT_TOKEN);
