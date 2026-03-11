import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LastWebhook = {
  at: string;
  headers: Record<string, string>;
  body: unknown;
};

const getDebugSecret = () => (process.env.HEYREACH_WEBHOOK_DEBUG_SECRET ?? "").trim();
const isAuthorized = (req: NextRequest) => {
  const secret = getDebugSecret();
  if (!secret) return true;
  const header = req.headers.get("x-heyreach-debug-secret")?.trim() ?? "";
  const query = new URL(req.url).searchParams.get("secret")?.trim() ?? "";
  return header === secret || query === secret;
};

let lastWebhook: LastWebhook | null = null;

type HeyreachMessage = {
  creation_time?: string;
  message?: string;
  is_reply?: boolean;
  message_type?: string;
};

type HeyreachPayload = {
  event_type?: string;
  conversation_id?: string;
  recent_messages?: HeyreachMessage[];
  sender?: { full_name?: string; profile_url?: string };
  lead?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    profile_url?: string;
    location?: string;
    summary?: string;
    company_name?: string;
    position?: string;
    about?: string;
  };
};

const COMMENT_RULES = `
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

VISIBILITY OFFER
- The offer to help with visibility should feel like a natural next step, not a pitch.
- Only include it if the comment has already delivered real value in the lines before it.
- Frame it as mutual: you are also learning from their audience and context.

OUTCOME TO OPTIMIZE FOR
- The reader should feel genuinely seen and want to reply.
- A comment that gets a reply beats a comment that gets a like.
- If you cannot add something specific and real, say less — not more.
`.trim();

const normalizeText = (text: string) =>
  text.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();

const pickLatestText = (messages: HeyreachMessage[] = []): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const type = (msg.message_type ?? "").toLowerCase();
    if (type === "attachment" || type === "voice") continue;
    const text = normalizeText(msg.message ?? "");
    if (text) return text;
  }
  return "";
};

const buildThreadSnapshot = (messages: HeyreachMessage[] = []): string =>
  messages
    .map((msg) => {
      const type = (msg.message_type ?? "").toLowerCase();
      if (type === "attachment") return "[attachment]";
      if (type === "voice") return "[voice note]";
      const text = normalizeText(msg.message ?? "");
      return text ? text : "[empty]";
    })
    .filter(Boolean)
    .slice(-12)
    .join("\n");

const buildLeadContext = (payload: HeyreachPayload): string => {
  const lead = payload.lead ?? {};
  const sender = payload.sender ?? {};
  const bits = [
    lead.full_name ? `lead_name: ${lead.full_name}` : "",
    lead.position ? `lead_role: ${lead.position}` : "",
    lead.company_name ? `lead_company: ${lead.company_name}` : "",
    lead.location ? `lead_location: ${lead.location}` : "",
    lead.summary ? `lead_summary: ${lead.summary}` : "",
    lead.about ? `lead_about: ${lead.about}` : "",
    sender.full_name ? `sender_name: ${sender.full_name}` : "",
    sender.profile_url ? `sender_profile: ${sender.profile_url}` : "",
    lead.profile_url ? `lead_profile: ${lead.profile_url}` : "",
  ].filter(Boolean);
  return bits.join("\n");
};

async function generateReply(input: {
  openaiApiKey: string;
  toneProfile: string;
  latestMessage: string;
  threadSnapshot: string;
  leadContext: string;
}): Promise<string> {
  const system =
    "you are a helpful bot. voice: humble, new, curious, always learning. keep replies short and human.";
  const prompt = `
${COMMENT_RULES}

tone_profile:
${input.toneProfile}

lead_context:
${input.leadContext || "none"}

latest_message:
${input.latestMessage}

thread_snapshot:
${input.threadSnapshot}

after the reply, add a separator line "###LEARNING###" and then 2 short bullet points with what the bot learned from this message.
`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.openaiApiKey}`,
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
  const content = d.choices?.[0]?.message?.content?.trim() || "";
  const [replyPart] = content.split("###LEARNING###");
  return replyPart.trim().slice(0, 600);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    lastWebhook = {
      at: new Date().toISOString(),
      headers,
      body,
    };
    console.log("[heyreach] webhook received", JSON.stringify(body));

    const payload = body as HeyreachPayload;
    const eventType = (payload.event_type ?? "").trim();
    const conversationId = (payload.conversation_id ?? "").trim();
    const recent = payload.recent_messages ?? [];
    if (!conversationId || recent.length === 0) {
      return NextResponse.json({ ok: true, skipped: "missing conversation or messages" });
    }
    if (eventType && eventType !== "every_message_reply_received") {
      return NextResponse.json({ ok: true, skipped: `ignored event ${eventType}` });
    }

    const openaiApiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    const heyreachApiKey = (process.env.HEYREACH_API_KEY ?? "").trim();
    const linkedInAccountId = Number.parseInt(
      (process.env.HEYREACH_LINKEDIN_ACCOUNT_ID ?? "").trim(),
      10,
    );
    if (!openaiApiKey || !heyreachApiKey || !Number.isFinite(linkedInAccountId)) {
      return NextResponse.json({ ok: false, error: "missing heyreach automation config" }, { status: 500 });
    }

    const latestMessage = pickLatestText(recent);
    if (!latestMessage) {
      return NextResponse.json({ ok: true, skipped: "no text message to reply to" });
    }

    const reply = await generateReply({
      openaiApiKey,
      toneProfile: (process.env.TONE_PROFILE ?? "direct creator").trim(),
      latestMessage,
      threadSnapshot: buildThreadSnapshot(recent),
      leadContext: buildLeadContext(payload),
    });
    if (!reply) {
      return NextResponse.json({ ok: false, error: "empty reply" }, { status: 500 });
    }

    const sendRes = await fetch("https://api.heyreach.io/api/public/inbox/SendMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain",
        "X-API-KEY": heyreachApiKey,
      },
      body: JSON.stringify({
        message: reply,
        subject: "",
        conversationId,
        linkedInAccountId,
      }),
    });

    if (!sendRes.ok) {
      let detail = "";
      try {
        detail = await sendRes.text();
      } catch {
        detail = "";
      }
      return NextResponse.json(
        { ok: false, error: `heyreach send failed (${sendRes.status}) ${detail}`.trim() },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!lastWebhook) {
    return NextResponse.json({ ok: false, error: "no webhook received yet" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lastWebhook });
}
