import { NextRequest, NextResponse } from "next/server";

type Draft = {
  draftId: string;
  sourceMessageId: string;
  sourceChannelId?: string;
  sourceTitle?: string;
  sourceAuthor: string;
  sourceText: string;
  threadMessages?: Array<{ id: string; author: string; text: string }>;
  lastConversationMessageId?: string;
  replyText: string;
  learning: string[];
  status?: "needs_reply" | "needs_followup" | "waiting" | "active";
  mode: "first_reply" | "thread_followup";
  artifactContext?: {
    productName?: string;
    productType?: string;
    audience?: string;
    intent?: string;
    summary?: string;
  };
  messagesSinceCheckpoint?: Array<{ id: string; author: string; text: string }>;
  contextCapturedUntilMessageId?: string;
  contextCapturedMessageCount?: number;
};

type Body = {
  openaiApiKey?: string;
  toneProfile?: string;
  drafts?: Draft[];
  refresh?: boolean;
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
  toneProfile: string;
  artifactContext: {
    productName: string;
    productType: string;
    audience: string;
    intent: string;
    summary: string;
  };
  messagesSinceCheckpoint: Array<{ id: string; author: string; text: string }>;
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
- never invent product names, audiences, or brands that are not present in the provided context
- if product context is missing, say "your project" instead of guessing
- prioritize the latest message context

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
    const toneProfile = body.toneProfile?.trim() || "direct creator";
    const refresh = Boolean(body.refresh);
    const drafts = body.drafts ?? [];

    if (!openaiApiKey) {
      return NextResponse.json({ ok: false, error: "missing openai api key" }, { status: 400 });
    }

    const out: Draft[] = [];
    for (const draft of drafts.slice(0, 20)) {
      if (!refresh && draft.replyText?.trim()) {
        out.push(draft);
        continue;
      }
      const generated = await draftReply({
        openaiApiKey,
        toneProfile,
        artifactContext: {
          productName: draft.artifactContext?.productName?.trim() ?? "",
          productType: draft.artifactContext?.productType?.trim() ?? "",
          audience: draft.artifactContext?.audience?.trim() ?? "",
          intent: draft.artifactContext?.intent?.trim() ?? "",
          summary: draft.artifactContext?.summary?.trim() ?? "",
        },
        messagesSinceCheckpoint: draft.messagesSinceCheckpoint ?? [],
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
