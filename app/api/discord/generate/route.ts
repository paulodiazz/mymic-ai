import { NextRequest, NextResponse } from "next/server";

type Draft = {
  draftId: string;
  sourceMessageId: string;
  sourceChannelId?: string;
  sourceTitle?: string;
  sourceAuthor: string;
  sourceText: string;
  replyText: string;
  learning: string[];
  status?: "needs_reply" | "active";
  mode: "first_reply" | "thread_followup";
};

type Body = {
  openaiApiKey?: string;
  productName?: string;
  audience?: string;
  drafts?: Draft[];
};

async function generateWithGpt(openaiApiKey: string, prompt: string, system: string): Promise<string> {
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
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";
    const productName = body.productName?.trim() || "my project";
    const audience = body.audience?.trim() || "builders";
    const drafts = (body.drafts ?? []).filter((d) => (d.status ?? "needs_reply") === "needs_reply");

    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "missing openai api key" }, { status: 400 });
    }

    const out: Draft[] = [];
    for (const draft of drafts.slice(0, 20)) {
      if (draft.replyText?.trim()) {
        out.push(draft);
        continue;
      }
      const generated = await draftReply({
        openaiApiKey,
        productName,
        audience,
        sourceText: draft.sourceText,
        sourceAuthor: draft.sourceAuthor || "unknown",
        mode: draft.mode ?? "first_reply",
      });
      out.push({
        ...draft,
        replyText: generated.replyText,
        learning: generated.learning,
      });
    }

    return NextResponse.json({ ok: true, drafts: out });
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord reply generation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

