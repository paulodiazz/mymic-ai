import { NextRequest, NextResponse } from "next/server";
import { generateReplyDraft } from "@/lib/discord/reply";

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const openaiApiKey =
      body.openaiApiKey?.trim() ||
      (process.env.OPENAI_API_KEY ?? "").trim();
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
      const generated = await generateReplyDraft({
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
