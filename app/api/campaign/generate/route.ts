import { NextRequest, NextResponse } from "next/server";

type Day = {
  day: number;
  post: string;
  play: string;
  format?: string;
  pillar?: string;
  imageRequired?: boolean;
  imagePrompt?: string;
};

type Body = {
  openaiApiKey?: string;
  campaignTone?: string;
  productName?: string;
  productType?: string;
  audience?: string;
  intent?: string;
  summary?: string;
  lastMessage?: string;
  days?: number;
  imageCount?: number;
};

async function generateWithGpt(openaiApiKey: string, prompt: string, system: string): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("missing openai api key for campaign generation");
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.6,
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
    throw new Error(`openai campaign generation failed (${r.status})${detail}`);
  }
  const d = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = d.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("openai campaign generation returned empty content");
  }
  return content;
}

function parseImageField(input: unknown): { imageRequired: boolean; imagePrompt?: string } {
  if (typeof input !== "string") {
    return { imageRequired: false };
  }
  const trimmed = input.trim();
  if (!trimmed) return { imageRequired: false };
  if (/^no\b/i.test(trimmed)) return { imageRequired: false };
  let description = trimmed.replace(/^yes\b[:\s-]*/i, "").trim();
  if (!description && !/^yes$/i.test(trimmed)) {
    description = trimmed;
  }
  return { imageRequired: true, imagePrompt: description || undefined };
}

function parsePlan(raw: string, days: number): Day[] {
  const stripFences = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  let jsonText = stripFences;
  const startArray = stripFences.indexOf("[");
  const endArray = stripFences.lastIndexOf("]");
  if (startArray >= 0 && endArray > startArray) {
    jsonText = stripFences.slice(startArray, endArray + 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("campaign generator returned invalid json");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { plan?: unknown }).plan ?? null;
  if (!Array.isArray(list)) {
    throw new Error("campaign generator response missing plan array");
  }

  const cleaned = list
    .map((item, idx) => {
      const safe = item as Partial<Day> & { image?: unknown };
      const post = String(safe.post ?? "").trim();
      const play = String(safe.play ?? "").trim();
      if (!post || !play) return null;
      const day = Number.isFinite(Number(safe.day)) ? Number(safe.day) : idx + 1;
      const format = typeof safe.format === "string" ? safe.format.trim() : "";
      const pillar = typeof safe.pillar === "string" ? safe.pillar.trim() : "";
      const imageParsed = parseImageField((safe as { image?: unknown }).image);
      return {
        day,
        post: post.slice(0, 260),
        play: play.slice(0, 240),
        format: format || undefined,
        pillar: pillar || undefined,
        imageRequired: imageParsed.imageRequired,
        imagePrompt: imageParsed.imagePrompt,
      };
    })
    .filter(Boolean) as Day[];

  return cleaned.slice(0, days).map((item, idx) => ({
    ...item,
    day: item.day || idx + 1,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";
    const days = Math.min(30, Math.max(1, body.days ?? 14));
    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "missing openai api key" }, { status: 400 });
    }

    const system =
      "you are the content strategist. follow the master prompt exactly and output only valid json.";
    const imageCount = Math.min(14, Math.max(0, body.imageCount ?? 0));
    const brand = body.productName || "this brand";
    const prompt = `
AUTONOMOUS X CONTENT STRATEGY — MASTER PROMPT
You are the content strategist for ${brand}. You think like a founder, write like a journalist, and understand growth like a product manager. You have three modes: PLAN, OPTIMIZE, and COMMENT. You will be told which mode to run.

==============================
REQUIRED INPUTS (inferred from conversation)
==============================

BRAND VOICE
- Core belief: infer from context_summary and intent
- The enemy: infer the bad practice or mindset from context_summary
- What we never say: corporate speak, feature lists, vague claims
- Tone anchors: infer from campaign_tone

AUDIENCE
- Who: ${body.audience || "infer from context_summary"}
- Their real frustration: infer from context_summary
- What they want to believe is possible: infer from context_summary
- What they are skeptical of: infer from context_summary

CONTENT PILLARS
Pick 3. Each post belongs to one. Never repeat the same pillar twice in a row.
- Pillar 1: the topic this account owns (derive from context_summary + product_type)
- Pillar 2: the topic this account has earned the right to discuss (derive from context_summary + intent)
- Pillar 3: the topic that connects the audience world to the brand world (derive from context_summary + audience)

POST FORMATS
Rotate these. Never use the same format back-to-back.
REFRAME, EARNED INSIGHT, TENSION, SPECIFIC STORY, SHARP TAKE

==============================
MODE 1 — PLAN
==============================

Trigger: new week, new campaign, or cold start.

Generate a 14-day content calendar. Follow this narrative arc exactly.

Days 1-3: EARN ATTENTION
Prove you understand their world better than they do. No product mentions.

Days 4-6: CREATE TENSION
Name the problem in a way they have not heard before. Still no product.

Days 7-9: INTRODUCE THE LENS
Show how you see differently. The product emerges naturally from the perspective, not as a pitch.

Days 10-12: PROVE IT
Specifics only. Numbers, before and after, real use cases, stories.

Days 13-14: CONVERT BELIEF
Strong conviction posts. Community signal. Soft invitation to act.

RULES FOR EVERY POST
- Max 260 characters
- No hashtags, no links
- First line must stop the scroll
- Never start with the product name, "We", or "I"
- No two consecutive posts in the same format
- No two consecutive posts in the same pillar
- Do not use adjectives where a number or story will do
- Do not write a post that could have been written by any other account in this space
- At least 2 posts must be opinion-led
- At least 1 post must reference a current tension or debate in the industry
- Do not mention the product before Day 7

IMAGE ASSIGNMENT
Total images allowed: ${imageCount} between 0 and 14.
If IMAGE_COUNT is greater than 0, assign images to the days where a visual would add the most impact. Priority order: product demos, contrast visuals, data made visual, story moments. For each image day, describe exactly what the image should show: composition, mood, any text overlay.

OUTPUT FORMAT PER POST
- day
- post
- play
- format
- pillar
- image (YES or NO, and if YES a precise description of the visual)

==============================
PLAN INPUTS
==============================
campaign_tone: ${body.campaignTone || "balanced, clear, confident"}
product_name: ${body.productName || "unknown"}
product_type: ${body.productType || "unknown"}
audience: ${body.audience || "unknown"}
intent: ${body.intent || "unknown"}
context_summary: ${body.summary || "unknown"}
last_message: ${body.lastMessage || "unknown"}

OUTPUT JSON ARRAY ONLY.`;

    const raw = await generateWithGpt(openaiApiKey, prompt, system);
    const plan = parsePlan(raw, days);
    if (!plan.length) {
      return NextResponse.json({ ok: false, error: "campaign generator returned empty plan" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "campaign generation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
