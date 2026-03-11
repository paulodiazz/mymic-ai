import { NextRequest, NextResponse } from "next/server";

type Item = { day: number; post: string; play: string; imagePrompt?: string };
type Body = {
  openaiApiKey?: string;
  model?: string;
  size?: string;
  campaignTone?: string;
  productName?: string;
  productType?: string;
  audience?: string;
  intent?: string;
  summary?: string;
  items?: Item[];
};

async function generateImage(input: {
  openaiApiKey: string;
  model: string;
  size: string;
  prompt: string;
}): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      n: 1,
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
    throw new Error(`openai image generation failed (${r.status})${detail}`);
  }
  const d = (await r.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  const entry = d.data?.[0];
  if (entry?.url) return entry.url;
  if (entry?.b64_json) return `data:image/png;base64,${entry.b64_json}`;
  throw new Error("openai image generation returned empty result");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";
    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "missing openai api key" }, { status: 400 });
    }

    const items = (body.items ?? []).slice(0, 20);
    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "no items provided" }, { status: 400 });
    }

    const model = body.model?.trim() || "gpt-image-1";
    const size = body.size?.trim() || "1024x1024";
    const productName = body.productName?.trim() || "unknown";
    const productType = body.productType?.trim() || "unknown";
    const audience = body.audience?.trim() || "unknown";
    const intent = body.intent?.trim() || "unknown";
    const summary = body.summary?.trim() || "unknown";
    const campaignTone = body.campaignTone?.trim() || "balanced, clear, confident";

    const images: Array<{ day: number; url: string; prompt: string }> = [];
    for (const item of items) {
      const customPrompt = item.imagePrompt?.trim();
      const prompt = `
create a clean, high-quality social image.
context:
- product: ${productName} (${productType})
- audience: ${audience}
- intent: ${intent}
- campaign tone: ${campaignTone}
- summary: ${summary}
post: ${item.post}
${customPrompt ? `custom art direction from user: ${customPrompt}` : ""}

visual guidelines:
- avoid text in the image unless the custom art direction explicitly asks for it
- bold, modern, high-contrast, minimal clutter
- convey the idea of the post without logos or brand marks
`;
      const url = await generateImage({ openaiApiKey, model, size, prompt });
      images.push({ day: item.day, url, prompt });
    }

    return NextResponse.json({ ok: true, images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image generation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
