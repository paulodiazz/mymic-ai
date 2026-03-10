import { NextRequest, NextResponse } from "next/server";

type Day = { day: number; post: string; play: string };

type Body = {
  openaiApiKey?: string;
  campaignTone?: string;
  productName?: string;
  productType?: string;
  audience?: string;
  intent?: string;
  summary?: string;
  days?: number;
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
      const safe = item as Partial<Day>;
      const post = String(safe.post ?? "").trim();
      const play = String(safe.play ?? "").trim();
      if (!post || !play) return null;
      const day = Number.isFinite(Number(safe.day)) ? Number(safe.day) : idx + 1;
      return {
        day,
        post: post.slice(0, 260),
        play: play.slice(0, 240),
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
      "you are a growth strategist writing short, high-signal campaign posts. output only valid json.";
    const prompt = `
create a ${days}-day social campaign plan.
rules:
- output JSON array only, no prose, no code fences
- each item: { "day": number, "post": string, "play": string }
- post: 1-2 sentences, max 260 chars, no hashtags, no links
- play: a concrete engagement action, 1 sentence, max 240 chars
- stay consistent with the product context and tone
- do not invent brands or audiences not present in the context

    campaign_tone: ${body.campaignTone || "balanced, clear, confident"}
    product_name: ${body.productName || "unknown"}
    product_type: ${body.productType || "unknown"}
    audience: ${body.audience || "unknown"}
intent: ${body.intent || "unknown"}
context_summary: ${body.summary || "unknown"}
`;

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
