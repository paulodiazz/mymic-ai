export type ReplyDraftInput = {
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
};

export type ReplyDraftOutput = {
  replyText: string;
  learning: string[];
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

export async function generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput> {
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
