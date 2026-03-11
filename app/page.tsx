"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Avatar,
  Divider,
  Image,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Pagination,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { supabase } from "../lib/supabase/client";

type Tone = { toneName: string; summary: string; styleGuide: string[] };
type ToneRes = {
  ok: boolean;
  error?: string;
  title?: string;
  wordCount?: number;
  source?: string;
  warning?: string;
  tone?: Tone;
};
type PublishRes = {
  platform: "x" | "linkedin" | "tiktok";
  ok: boolean;
  message: string;
  postId?: string;
};
type DiscoverPost = {
  id: string;
  text: string;
  authorUsername: string;
  score: number;
};
type Day = {
  day: number;
  post: string;
  play: string;
  format?: string;
  pillar?: string;
  imageRequired?: boolean;
  images?: string[];
  imagePrompt?: string;
  imagePromptOverride?: string;
};
type DiscordDraft = {
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
};
type LearningItem = {
  at: string;
  sourceMessageId: string;
  notes: string[];
};
type ConversationArtifact = {
  id: string;
  draftId: string;
  sourceMessageId: string;
  sourceChannelId?: string;
  sourceTitle?: string;
  sourceAuthor: string;
  status: "needs_reply" | "needs_followup" | "waiting" | "active";
  productName: string;
  productType: string;
  audience: string;
  intent: string;
  actionCredentialMode: "owner" | "product";
  xToken: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  plan: Day[];
  day: number;
  posted: number[];
  postedTweetIds: string[];
  views: number;
  replies: number;
  followers: number;
  campaignId: string;
  campaignArchive: CampaignSnapshot[];
  contextSummary: string;
  lastMessage: string;
  lastConversationMessageId: string;
  contextCapturedUntilMessageId: string;
  contextCapturedMessageCount: number;
  updatedAt: string;
};
type CampaignSnapshot = {
  id: string;
  createdAt: string;
  productName: string;
  plan: Day[];
  posted: number[];
  postedTweetIds: string[];
  views: number;
  replies: number;
  followers: number;
};
type BotProfile = {
  id: string;
  name: string;
  productName: string;
  productType: string;
  audience: string;
  goal: string;
  actionCredentialMode: "owner" | "product";
  youtubeUrl: string;
  toneProfile: string;
  botPersonality: string;
  campaignTone: string;
  campaignImageCount: number;
  campaignImageModel: string;
  campaignImageSize: string;
  xToken: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  discordBotToken: string;
  discordInviteUrl: string;
  discordChannelName: string;
  discordChannelId: string;
  discordSeenMessageIds: string[];
  discordPendingDrafts: DiscordDraft[];
  discordActiveThreads: DiscordDraft[];
  discordLearningLog: LearningItem[];
  conversationArtifacts: ConversationArtifact[];
  plan: Day[];
  day: number;
  posted: number[];
  postedTweetIds: string[];
  views: number;
  replies: number;
  followers: number;
  campaignId: string;
  campaignArchive: CampaignSnapshot[];
  createdAt: string;
};
const BOT_PERSONALITY =
  "i'm a new bot, a little clumsy, but i learn fast when people help me.";
const PRICING = {
  inputPer1M: 0.4,
  outputPer1M: 1.6,
};
const IMAGE_PRICING_MEDIUM: Record<string, number> = {
  "1024x1024": 0.042,
  "1024x1536": 0.063,
  "1536x1024": 0.063,
};
const getImageCost = (size: string) => IMAGE_PRICING_MEDIUM[size] ?? 0.042;
const IMAGE_MODEL_OPTIONS = [{ key: "gpt-image-1", label: "gpt-image-1" }];
const IMAGE_SIZE_OPTIONS = [
  { key: "1024x1024", label: "1024x1024 (square)" },
  { key: "1024x1536", label: "1024x1536 (portrait)" },
  { key: "1536x1024", label: "1536x1024 (landscape)" },
];
const CAMPAIGN_SYSTEM =
  "you are a growth strategist writing short, high-signal campaign posts. output only valid json.";
type AppState = {
  started: boolean;
  selectedTab: "account" | "power" | "product" | "connections" | "actions";
  actionCredentialMode: "owner" | "product";
  productName: string;
  productType: string;
  audience: string;
  goal: string;
  youtubeUrl: string;
  openaiApiKey: string;
  toneProfile: string;
  botPersonality: string;
  campaignTone: string;
  campaignImageCount: number;
  campaignImageModel: string;
  campaignImageSize: string;
  xToken: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  ownerXToken: string;
  ownerXApiKey: string;
  ownerXApiSecret: string;
  ownerXAccessToken: string;
  ownerXAccessTokenSecret: string;
  discordBotToken: string;
  discordInviteUrl: string;
  discordChannelName: string;
  discordChannelId: string;
  discordSeenMessageIds: string[];
  discordPendingDrafts: DiscordDraft[];
  discordActiveThreads: DiscordDraft[];
  discordLearningLog: LearningItem[];
  conversationArtifacts: ConversationArtifact[];
  plan: Day[];
  day: number;
  posted: number[];
  postedTweetIds: string[];
  views: number;
  replies: number;
  followers: number;
  autoPost: boolean;
  autoComment: boolean;
  autoMetrics: boolean;
  campaignId: string;
  campaignArchive: CampaignSnapshot[];
  bots: BotProfile[];
  activeBotId: string | null;
};

const DEFAULT_STATE: AppState = {
  started: false,
  selectedTab: "product",
  actionCredentialMode: "owner",
  productName: "",
  productType: "",
  audience: "",
  goal: "",
  youtubeUrl: "",
  openaiApiKey: "",
  toneProfile: "direct creator",
  botPersonality: BOT_PERSONALITY,
  campaignTone: "balanced, clear, confident",
  campaignImageCount: 0,
  campaignImageModel: "gpt-image-1",
  campaignImageSize: "1024x1024",
  xToken: "",
  xApiKey: "",
  xApiSecret: "",
  xAccessToken: "",
  xAccessTokenSecret: "",
  ownerXToken: "",
  ownerXApiKey: "",
  ownerXApiSecret: "",
  ownerXAccessToken: "",
  ownerXAccessTokenSecret: "",
  discordBotToken: "",
  discordInviteUrl: "https://discord.gg/vCpQWbkD",
  discordChannelName: "i-shipped",
  discordChannelId: "",
  discordSeenMessageIds: [],
  discordPendingDrafts: [],
  discordActiveThreads: [],
  discordLearningLog: [],
  conversationArtifacts: [],
  plan: [],
  day: 1,
  posted: [],
  postedTweetIds: [],
  views: 0,
  replies: 0,
  followers: 0,
  autoPost: true,
  autoComment: true,
  autoMetrics: true,
  campaignId: "",
  campaignArchive: [],
  bots: [],
  activeBotId: null,
};

const toComposeUrl = (text: string): string =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
const cleanPostText = (text: string): string =>
  text.replace(/^\s*\[tone:[^\]]+\]\s*/i, "").trim();
const newCampaignId = (): string =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const newBotId = (): string =>
  `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MASTER_EMAIL = "paulodiazg32@gmail.com";

type ThreadMessage = { id: string; author: string; text: string; mine: boolean };

function parseDiscordThreadMessages(
  sourceText: string,
  sourceAuthor: string,
  botAliases: string[],
): ThreadMessage[] {
  const normalizedAliases = botAliases
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const isMine = (author: string): boolean => {
    const normalized = author.trim().toLowerCase();
    if (!normalized) return false;
    return normalizedAliases.some((alias) => alias === normalized);
  };

  const [bodyPart, commentsPart] = sourceText.split(/\n\ncomments:\n/i);
  const out: ThreadMessage[] = [];

  const body = (bodyPart ?? "").trim();
  if (body) {
    out.push({
      id: `starter-${sourceAuthor}`,
      author: sourceAuthor || "unknown",
      text: body,
      mine: isMine(sourceAuthor),
    });
  }

  const commentLines = (commentsPart ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  for (let idx = 0; idx < commentLines.length; idx += 1) {
    const line = commentLines[idx].replace(/^-+\s*/, "").trim();
    const match = line.match(/^@([^:]+):\s*(.*)$/);
    if (match) {
      const author = match[1].trim();
      const text = match[2].trim();
      out.push({
        id: `comment-${idx}-${author}`,
        author,
        text: text || "(empty message)",
        mine: isMine(author),
      });
      continue;
    }
    out.push({
      id: `comment-${idx}-unknown`,
      author: "unknown",
      text: line,
      mine: false,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "raw-fallback",
      author: sourceAuthor || "unknown",
      text: sourceText,
      mine: isMine(sourceAuthor),
    });
  }

  return out;
}

function inferProductType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("consultant") || lower.includes("consulting")) return "consulting";
  if (lower.includes("marketing")) return "marketing";
  if (lower.includes("saas")) return "saas";
  if (lower.includes("newsletter")) return "newsletter";
  if (lower.includes("course")) return "course";
  if (lower.includes("community")) return "community";
  if (lower.includes("agency")) return "service";
  if (lower.includes("app")) return "app";
  return "";
}

function extractRelatedToPhrase(text: string): string {
  const lower = text.toLowerCase();
  const match = lower.match(/related to\s+([a-z0-9\s-]{3,80})/i);
  if (!match?.[1]) return "";
  return match[1].trim().replace(/\s+/g, " ");
}

function cleanProductName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .trim();
}

function inferProductNameFromBody(body: string): string {
  const pivotMatch =
    body.match(/pivot(?:ed)?\s+(?:to|into)\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  if (pivotMatch) return cleanProductName(pivotMatch);
  const focusMatch =
    body.match(/now\s+(?:focused|focusing)\s+on\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  if (focusMatch) return cleanProductName(focusMatch);
  const buildMatch =
    body.match(
      /(?:we\s+are|we're|now\s+we're|we\s+just)\s+(?:building|shipping|launching|working on|focusing on|pivoting to)\s+([^.,;\n]{3,120})/i
    )?.[1] ?? "";
  if (buildMatch) return cleanProductName(buildMatch);
  const productMatch =
    body.match(/(?:product|project)\s+(?:is|:)\s+([^.,;\n]{3,120})/i)?.[1] ?? "";
  if (productMatch) return cleanProductName(productMatch);
  const related = extractRelatedToPhrase(body);
  if (related) return cleanProductName(related);
  return "";
}

function inferAudience(text: string): string {
  const lower = text.toLowerCase();
  const explicit =
    lower.match(/audience\s+(?:is\s+)?(?:mainly\s+|mostly\s+)?([a-z0-9\s,&-]{3,120})/i)?.[1] ?? "";
  if (explicit.trim()) return explicit.trim().replace(/\s+/g, " ");
  const target =
    lower.match(/(?:target|for)\s+([a-z0-9\s,&-]{3,120})/i)?.[1] ?? "";
  if (target.trim()) return target.trim().replace(/\s+/g, " ");
  if (lower.includes("mexican coffee")) return "mexican coffee brands";
  if (lower.includes("founder")) return "founders";
  if (lower.includes("creator")) return "creators";
  if (lower.includes("developer") || lower.includes("dev")) return "developers";
  return "";
}

function inferIntent(text: string): string {
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
}

function buildArtifactFromDraft(
  draft: DiscordDraft,
  existing?: ConversationArtifact,
): ConversationArtifact {
  const structured = (draft.threadMessages ?? []).map((msg) => ({
    id: msg.id,
    author: msg.author,
    text: msg.text,
    mine: false,
  }));
  const messages =
    structured.length > 0
      ? structured
      : parseDiscordThreadMessages(draft.sourceText, draft.sourceAuthor, ["mymic"]);
  const latest = messages[messages.length - 1];
  const latestConversationMessageId = draft.lastConversationMessageId || latest?.id || "";
  if (existing && existing.lastConversationMessageId === latestConversationMessageId) {
    return {
      ...existing,
      sourceMessageId: draft.sourceMessageId,
      sourceChannelId: draft.sourceChannelId,
      sourceTitle: draft.sourceTitle,
      sourceAuthor: draft.sourceAuthor,
      status: draft.status ?? existing.status,
      lastMessage: latest?.text ?? existing.lastMessage,
      lastConversationMessageId: latestConversationMessageId,
    };
  }
  const rawBody = messages.map((m) => m.text).join(" ");
  const body = rawBody.toLowerCase();
  const inferredName = inferProductNameFromBody(rawBody);
  const inferredAudience = inferAudience(body) || existing?.audience || "";
  const inferredIntent = inferIntent(body) || existing?.intent || "";
  const fallbackName =
    existing?.productName ||
    (draft.sourceTitle && draft.sourceTitle.toLowerCase() !== "untitled thread"
      ? draft.sourceTitle
      : draft.sourceAuthor
        ? `${draft.sourceAuthor}'s project`
        : "unknown project");
  const resolvedName = inferredName || fallbackName;
  const engagementSignal = body.includes("interested") || body.includes("okay");
  const summaryParts = [
    engagementSignal ? "customer engaged and asked about visibility support." : "",
    resolvedName ? `product focus: ${resolvedName}.` : "",
    inferredAudience ? `audience: ${inferredAudience}.` : "",
    inferredIntent ? `intent: ${inferredIntent}.` : "",
    inferProductType(body) === "consulting" ? "context indicates a consultant-led service." : "",
    (() => {
      const summary = summarizeThreadMessages(messages, 1400);
      return summary ? `thread summary: ${summary}` : "";
    })(),
  ].filter(Boolean);

  return {
    id: existing?.id ?? `a-${draft.draftId}`,
    draftId: draft.draftId,
    sourceMessageId: draft.sourceMessageId,
    sourceChannelId: draft.sourceChannelId,
    sourceTitle: draft.sourceTitle,
    sourceAuthor: draft.sourceAuthor,
    status: draft.status ?? "needs_reply",
    productName: resolvedName,
    productType: inferProductType(body) || existing?.productType || "",
    audience: inferredAudience,
    intent: inferredIntent,
    actionCredentialMode: existing?.actionCredentialMode ?? "owner",
    xToken: existing?.xToken ?? "",
    xApiKey: existing?.xApiKey ?? "",
    xApiSecret: existing?.xApiSecret ?? "",
    xAccessToken: existing?.xAccessToken ?? "",
    xAccessTokenSecret: existing?.xAccessTokenSecret ?? "",
    plan: existing?.plan ?? [],
    day: existing?.day ?? 1,
    posted: existing?.posted ?? [],
    postedTweetIds: existing?.postedTweetIds ?? [],
    views: existing?.views ?? 0,
    replies: existing?.replies ?? 0,
    followers: existing?.followers ?? 0,
    campaignId: existing?.campaignId ?? newCampaignId(),
    campaignArchive: existing?.campaignArchive ?? [],
    contextSummary: summaryParts.join(" ").slice(0, 2000),
    lastMessage: latest?.text ?? "",
    lastConversationMessageId: latestConversationMessageId,
    contextCapturedUntilMessageId: existing?.contextCapturedUntilMessageId ?? "",
    contextCapturedMessageCount: existing?.contextCapturedMessageCount ?? 0,
    updatedAt: new Date().toISOString(),
  };
}

function buildCondensedContextFromMessages(
  messages: Array<{ id: string; author: string; text: string }>,
): {
  summary: string;
  capturedUntilMessageId: string;
  capturedMessageCount: number;
  lastMessage: string;
  productName: string;
  productType: string;
  audience: string;
  intent: string;
} {
  const safe = messages.filter((m) => Boolean(m.text?.trim()));
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
}

function summarizeThreadMessages(
  messages: Array<{ id: string; author: string; text: string }>,
  maxChars = 1200,
): string {
  const safe = messages.filter((m) => Boolean(m.text?.trim()));
  if (safe.length === 0) return "";
  const authors = Array.from(
    new Set(safe.map((m) => (m.author || "unknown").trim()).filter(Boolean)),
  );
  const normalize = (text: string) =>
    text.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();
  const splitSentences = (text: string) =>
    normalize(text)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const questions: string[] = [];
  const goals: string[] = [];
  const constraints: string[] = [];
  const facts: string[] = [];

  safe.forEach((m, idx) => {
    const sentences = splitSentences(m.text || "");
    if (sentences.length === 0) return;
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
      if (
        /\b(can't|cannot|must|should|avoid|don't|do not|no\s+|won't)\b/.test(lower)
      ) {
        constraints.push(s);
      }
    }
  });

  const last = safe[safe.length - 1];
  const latest = last?.text ? normalize(last.text) : "";

  const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => normalize(s))).values());
  const pick = (arr: string[], limit: number) => uniq(arr).slice(0, limit);

  const parts = [
    authors.length > 0 ? `participants: ${authors.join(", ")}.` : "",
    facts.length > 0 ? `thread gist: ${pick(facts, 2).join(" ")}` : "",
    goals.length > 0 ? `goals: ${pick(goals, 2).join(" ")}` : "",
    constraints.length > 0 ? `constraints: ${pick(constraints, 2).join(" ")}` : "",
    questions.length > 0 ? `open questions: ${pick(questions, 2).join(" ")}` : "",
    latest ? `latest message: ${latest}` : "",
  ].filter(Boolean);

  const summary = parts.join(" ");
  if (summary.length <= maxChars) return summary;
  return `${summary.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildCampaignPromptText(input: {
  days: number;
  campaignTone: string;
  imageCount: number;
  productName: string;
  productType: string;
  audience: string;
  intent: string;
  summary: string;
  lastMessage: string;
}): string {
  return `
AUTONOMOUS X CONTENT STRATEGY — MASTER PROMPT
You are the content strategist for ${input.productName || "this brand"}.

REQUIRED INPUTS (infer from context_summary + product inputs)
BRAND VOICE
- Core belief: infer from context_summary; if unclear, anchor on intent.
- The enemy: infer the bad practice or mindset from context_summary.
- What we never say: corporate speak, feature lists, vague claims.
- Tone anchors: infer from campaign_tone.

AUDIENCE
- Who: ${input.audience || "infer from context_summary"}
- Their real frustration: infer from context_summary.
- What they want to believe is possible: infer from context_summary.
- What they are skeptical of: infer from context_summary.

CONTENT PILLARS
Pick 3. Derive from context_summary + product_type + intent. Never repeat twice in a row.

POST FORMATS
REFRAME, EARNED INSIGHT, TENSION, SPECIFIC STORY, SHARP TAKE (rotate, never repeat back-to-back).

MODE 1 — PLAN (14-day plan)
Days 1-3: Earn attention (no product).
Days 4-6: Create tension (no product).
Days 7-9: Introduce the lens (product emerges).
Days 10-12: Prove it (specifics + numbers).
Days 13-14: Convert belief (conviction + soft CTA).

RULES
- Max 260 chars, no hashtags, no links.
- First line stops the scroll.
- Never start with product name, "We", or "I".
- No two consecutive posts in same format or pillar.
- At least 2 opinion-led posts.
- At least 1 post references a current industry tension.
- Do not mention product before Day 7.

IMAGE ASSIGNMENT
Total images allowed: ${input.imageCount} between 0 and 14.
If IMAGE_COUNT > 0, assign images to highest-impact days and describe the exact visual.

OUTPUT FORMAT PER POST
- day, post, play, format, pillar, image (YES/NO + description).

create a ${input.days}-day social campaign plan.
rules:
- output JSON array only, no prose, no code fences
- each item: { "day": number, "post": string, "play": string }
- post: 1-2 sentences, max 260 chars, no hashtags, no links
- play: a concrete engagement action, 1 sentence, max 240 chars
- stay consistent with the product context and tone
- do not invent brands or audiences not present in the context

campaign_tone: ${input.campaignTone}
product_name: ${input.productName}
product_type: ${input.productType}
audience: ${input.audience}
intent: ${input.intent}
context_summary: ${input.summary}
last_message: ${input.lastMessage}
`;
}

const IMAGE_HINTS: Array<{ words: string[]; reason: string; weight: number }> = [
  { words: ["launch", "release", "ship", "shipped", "announcement"], reason: "launch or release update", weight: 3 },
  { words: ["demo", "walkthrough", "tour", "preview"], reason: "demo or preview moment", weight: 3 },
  { words: ["design", "ui", "ux", "layout", "style", "branding"], reason: "visual/design update", weight: 3 },
  { words: ["feature", "capability", "build", "update", "improvement"], reason: "feature highlight", weight: 2 },
  { words: ["milestone", "progress", "roadmap", "next"], reason: "progress milestone", weight: 2 },
  { words: ["before", "after", "upgrade", "refactor"], reason: "before/after story", weight: 2 },
  { words: ["feedback", "community", "users", "customers"], reason: "community moment", weight: 1 },
];

function scoreImageFit(text: string): { score: number; reason: string } {
  const lower = text.toLowerCase();
  let best = { score: 0, reason: "general update" };
  for (const hint of IMAGE_HINTS) {
    if (hint.words.some((w) => lower.includes(w))) {
      if (hint.weight > best.score) {
        best = { score: hint.weight, reason: hint.reason };
      }
    }
  }
  return best;
}

function suggestImageDays(
  plan: Day[],
  count: number,
  posted: number[],
): Array<{ day: number; post: string; reason: string }> {
  const candidates = plan.filter(
    (item) => !(item.images?.length) && !posted.includes(item.day),
  );
  const scored = candidates.map((item) => {
    const fit = scoreImageFit(item.post);
    return { day: item.day, post: item.post, reason: fit.reason, score: fit.score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.day - b.day;
  });
  return scored.slice(0, count).map(({ day, post, reason }) => ({ day, post, reason }));
}

function getMessagesSinceCheckpoint(
  messages: Array<{ id: string; author: string; text: string }>,
  capturedUntilMessageId: string,
): Array<{ id: string; author: string; text: string }> {
  const safe = messages.filter((m) => Boolean(m.text?.trim()));
  if (!capturedUntilMessageId) return safe;
  const idx = safe.findIndex((m) => m.id === capturedUntilMessageId);
  if (idx < 0) return safe;
  return safe.slice(idx + 1);
}

function wipeConversationCache(state: AppState): AppState {
  const clearBot = (bot: BotProfile): BotProfile => ({
    ...bot,
    discordSeenMessageIds: [],
    discordPendingDrafts: [],
    discordActiveThreads: [],
    discordLearningLog: [],
    conversationArtifacts: [],
  });
  return {
    ...state,
    discordSeenMessageIds: [],
    discordPendingDrafts: [],
    discordActiveThreads: [],
    discordLearningLog: [],
    conversationArtifacts: [],
    bots: (state.bots ?? []).map(clearBot),
  };
}

function normalizeConversationArtifact(
  artifact: Partial<ConversationArtifact>,
): ConversationArtifact {
  return {
    id: artifact.id ?? `a-${artifact.draftId ?? Date.now().toString(36)}`,
    draftId: artifact.draftId ?? "",
    sourceMessageId: artifact.sourceMessageId ?? "",
    sourceChannelId: artifact.sourceChannelId,
    sourceTitle: artifact.sourceTitle,
    sourceAuthor: artifact.sourceAuthor ?? "unknown",
    status: artifact.status ?? "needs_reply",
    productName: artifact.productName ?? "",
    productType: artifact.productType ?? "",
    audience: artifact.audience ?? "",
    intent: artifact.intent ?? "",
    actionCredentialMode: artifact.actionCredentialMode ?? "owner",
    xToken: artifact.xToken ?? "",
    xApiKey: artifact.xApiKey ?? "",
    xApiSecret: artifact.xApiSecret ?? "",
    xAccessToken: artifact.xAccessToken ?? "",
    xAccessTokenSecret: artifact.xAccessTokenSecret ?? "",
    plan: Array.isArray(artifact.plan) ? artifact.plan : [],
    day: artifact.day ?? 1,
    posted: Array.isArray(artifact.posted) ? artifact.posted : [],
    postedTweetIds: Array.isArray(artifact.postedTweetIds) ? artifact.postedTweetIds : [],
    views: artifact.views ?? 0,
    replies: artifact.replies ?? 0,
    followers: artifact.followers ?? 0,
    campaignId: artifact.campaignId ?? newCampaignId(),
    campaignArchive: Array.isArray(artifact.campaignArchive) ? artifact.campaignArchive : [],
    contextSummary: artifact.contextSummary ?? "",
    lastMessage: artifact.lastMessage ?? "",
    lastConversationMessageId: artifact.lastConversationMessageId ?? "",
    contextCapturedUntilMessageId: artifact.contextCapturedUntilMessageId ?? "",
    contextCapturedMessageCount: artifact.contextCapturedMessageCount ?? 0,
    updatedAt: artifact.updatedAt ?? new Date().toISOString(),
  };
}

function hasXConnection(input: {
  xToken?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
}): boolean {
  return (
    Boolean(input.xToken) ||
    (Boolean(input.xApiKey) &&
      Boolean(input.xApiSecret) &&
      Boolean(input.xAccessToken) &&
      Boolean(input.xAccessTokenSecret))
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMsg, setAuthMsg] = useState("");
  const [xHelpOpen, setXHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [botNameInput, setBotNameInput] = useState("");
  const [showBotControls, setShowBotControls] = useState(false);
  const [openBotVoiceId, setOpenBotVoiceId] = useState<string | null>(null);
  const [toneAnalyzingBotId, setToneAnalyzingBotId] = useState<string | null>(null);
  const [showFullPosts, setShowFullPosts] = useState(false);
  const [campaignView, setCampaignView] = useState<"overview" | "day">("overview");
  const [campaignDayFocus, setCampaignDayFocus] = useState(1);
  const [imageSuggestions, setImageSuggestions] = useState<Array<{ day: number; post: string; reason: string }>>([]);

  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);

  const [toneMsg, setToneMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishRes[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsMsg, setMetricsMsg] = useState("");
  const [campaignGenerating, setCampaignGenerating] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [planRefining, setPlanRefining] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoverPost[]>([]);
  const [discoverMsg, setDiscoverMsg] = useState("");
  const [engaging, setEngaging] = useState(false);
  const [engageMsg, setEngageMsg] = useState("");
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationMsg, setAutomationMsg] = useState("");
  const [automationLog, setAutomationLog] = useState<string[]>([]);
  const [campaignArchiveViewId, setCampaignArchiveViewId] = useState<string | null>(null);
  const [discordSyncing, setDiscordSyncing] = useState(false);
  const [discordGenerating, setDiscordGenerating] = useState(false);
  const [discordMsg, setDiscordMsg] = useState("");
  const [discordPostingDraftId, setDiscordPostingDraftId] = useState<string | null>(null);
  const [discordViewTab, setDiscordViewTab] = useState<"needs_reply" | "active">("needs_reply");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const userId = session?.user?.id;

  useEffect(() => {
    if (!supabase) {
      setAuthMsg(
        "cloud auth is off: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to enable sign-in.",
      );
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadState() {
      if (!userId) {
        setState(DEFAULT_STATE);
        setStateLoaded(false);
        return;
      }
      if (!supabase) {
        setStateLoaded(true);
        return;
      }

      const accessToken = session?.access_token ?? "";
      if (!accessToken) {
        setStateLoaded(true);
        return;
      }

      try {
        const r = await fetch("/api/state/load", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });
        const d = (await r.json()) as { ok: boolean; error?: string; state?: AppState | null };
        if (!d.ok) {
          setAuthMsg(d.error ?? "could not load your cloud state.");
          setStateLoaded(true);
          return;
        }

        if (d.state) {
          const merged = { ...DEFAULT_STATE, ...(d.state as Partial<AppState>) };
          if (!merged.campaignId) merged.campaignId = newCampaignId();
          if (!Array.isArray(merged.campaignArchive)) merged.campaignArchive = [];
          merged.conversationArtifacts = Array.isArray(merged.conversationArtifacts)
            ? merged.conversationArtifacts.map((item) =>
                normalizeConversationArtifact(item as Partial<ConversationArtifact>),
              )
            : [];
          setState(merged);
        } else {
          const fresh = { ...DEFAULT_STATE, campaignId: newCampaignId() };
          setState(fresh);
          await fetch("/api/state/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ state: fresh }),
          });
        }
      } catch {
        setAuthMsg("could not load your cloud state.");
      }

      setStateLoaded(true);
    }

    loadState();
  }, [userId, session?.access_token]);

  useEffect(() => {
    if (!userId || !stateLoaded) return;
    const accessToken = session?.access_token ?? "";
    if (!accessToken) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/state/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ state }),
        });
        const d = (await r.json()) as { ok: boolean; error?: string };
        if (!d.ok) {
          setAuthMsg(d.error ?? "cloud save failed.");
        }
      } catch {
        setAuthMsg("cloud save failed.");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, state, stateLoaded, session?.access_token]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      setCursor({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useEffect(() => {
    if (state.conversationArtifacts.length === 0) {
      if (selectedArtifactId !== null) setSelectedArtifactId(null);
      return;
    }
    const exists = state.conversationArtifacts.some((item) => item.id === selectedArtifactId);
    if (!exists) {
      setSelectedArtifactId(state.conversationArtifacts[0].id);
    }
  }, [state.conversationArtifacts, selectedArtifactId]);

  // Removed the one-time auto reset that could wipe bots/credentials unexpectedly.

  const primaryArtifact =
    state.conversationArtifacts.find((item) => {
      const status = item.status ?? "needs_reply";
      return status === "needs_reply" || status === "needs_followup";
    }) ?? state.conversationArtifacts[0] ?? null;
  const selectedArtifact =
    state.conversationArtifacts.find((item) => item.id === selectedArtifactId) ?? primaryArtifact;

  const ownerConnections = {
    xToken: state.ownerXToken,
    xApiKey: state.ownerXApiKey,
    xApiSecret: state.ownerXApiSecret,
    xAccessToken: state.ownerXAccessToken,
    xAccessTokenSecret: state.ownerXAccessTokenSecret,
  };
  const artifactConnections = {
    xToken: selectedArtifact?.xToken ?? "",
    xApiKey: selectedArtifact?.xApiKey ?? "",
    xApiSecret: selectedArtifact?.xApiSecret ?? "",
    xAccessToken: selectedArtifact?.xAccessToken ?? "",
    xAccessTokenSecret: selectedArtifact?.xAccessTokenSecret ?? "",
  };
  const activeCredentialMode = selectedArtifact?.actionCredentialMode ?? "owner";
  const activeConnections =
    activeCredentialMode === "owner" ? ownerConnections : artifactConnections;
  const hasProductX = hasXConnection(artifactConnections);
  const hasOwnerX = hasXConnection(ownerConnections);
  const hasActionX = hasXConnection(activeConnections);
  const actionPlan = selectedArtifact?.plan ?? [];
  const actionDay = selectedArtifact?.day ?? 1;
  const today = actionPlan[actionDay - 1];
  const archiveView =
    campaignArchiveViewId && selectedArtifact?.campaignArchive
      ? selectedArtifact.campaignArchive.find((item) => item.id === campaignArchiveViewId) ?? null
      : null;
  const campaignPlan = archiveView?.plan ?? actionPlan;
  const campaignPosted = archiveView?.posted ?? selectedArtifact?.posted ?? [];
  const selectedTab =
    state.selectedTab === "account" ? "product" : state.selectedTab;
  const todayCleanPost = today ? cleanPostText(today.post) : "";
  const progress = actionPlan.length ? Math.round((actionDay / 14) * 100) : 0;
  const postedCount = selectedArtifact?.posted?.length ?? 0;
  const isMasterUser = (session?.user?.email ?? "").toLowerCase() === MASTER_EMAIL;
  const activeBot = state.bots.find((bot) => bot.id === state.activeBotId) ?? null;
  const displayName =
    activeBot?.name || selectedArtifact?.productName || "mymic bot";
  const handle = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "mymic";
  const canGenerate =
    !!selectedArtifact?.productName &&
    !!selectedArtifact?.productType &&
    !!selectedArtifact?.audience &&
    !!selectedArtifact?.intent &&
    !!state.openaiApiKey.trim();
  const campaignDays = 14;
  const imageCount = Math.min(14, Math.max(0, Math.round(state.campaignImageCount)));
  const estimatedInputTokens = useMemo(() => {
    const prompt = buildCampaignPromptText({
      days: campaignDays,
      campaignTone: state.campaignTone || "balanced, clear, confident",
      imageCount,
      productName: selectedArtifact?.productName ?? "unknown",
      productType: selectedArtifact?.productType ?? "unknown",
      audience: selectedArtifact?.audience ?? "unknown",
      intent: selectedArtifact?.intent ?? "unknown",
      summary: selectedArtifact?.contextSummary ?? "unknown",
      lastMessage: selectedArtifact?.lastMessage ?? "",
    });
    return estimateTokensFromText(`${CAMPAIGN_SYSTEM}\n${prompt}`);
  }, [
    campaignDays,
    selectedArtifact?.productName,
    selectedArtifact?.productType,
    selectedArtifact?.audience,
    selectedArtifact?.intent,
    selectedArtifact?.contextSummary,
    state.campaignTone,
    imageCount,
  ]);
  const estimatedOutputTokens = campaignDays * 120;
  const estimatedInputCost = (estimatedInputTokens / 1_000_000) * PRICING.inputPer1M;
  const estimatedOutputCost = (estimatedOutputTokens / 1_000_000) * PRICING.outputPer1M;
  const estimatedImageCost = imageCount * getImageCost(state.campaignImageSize);
  const estimatedTotalCost = estimatedInputCost + estimatedOutputCost + estimatedImageCost;
  const newPostsCount = state.discordPendingDrafts.filter(
    (item) => (item.status ?? "needs_reply") === "needs_reply",
  ).length;
  const followUpCount = state.discordPendingDrafts.filter(
    (item) => item.status === "needs_followup",
  ).length;
  const waitingCount = state.discordActiveThreads.filter((item) => {
    const status = item.status ?? "waiting";
    return status === "waiting" || status === "active";
  }).length;
  const dayViewItem =
    campaignPlan.find((item) => item.day === campaignDayFocus) ?? campaignPlan[0] ?? null;
  const dayViewIsPosted = dayViewItem
    ? campaignPosted.includes(dayViewItem.day)
    : false;

  useEffect(() => {
    if (!campaignPlan.length) {
      setCampaignDayFocus(1);
      return;
    }
    setCampaignDayFocus((prev) => {
      const max = campaignPlan.length;
      const desired = archiveView ? 1 : selectedArtifact?.day ?? 1;
      if (prev < 1 || prev > max) return Math.min(max, Math.max(1, desired));
      return prev;
    });
  }, [campaignPlan.length, selectedArtifact?.day, archiveView]);

  useEffect(() => {
    if (campaignArchiveViewId) {
      setCampaignDayFocus(1);
    }
  }, [campaignArchiveViewId]);

  useEffect(() => {
    if (state.selectedTab === "account") {
      setState((prev) =>
        prev.selectedTab === "account" ? { ...prev, selectedTab: "product" } : prev,
      );
      return;
    }
    if (!isMasterUser && state.selectedTab === "power") {
      setState((prev) =>
        prev.selectedTab === "power" ? { ...prev, selectedTab: "product" } : prev,
      );
      return;
    }
  }, [isMasterUser, state.selectedTab]);

  const update = (patch: Partial<AppState>) => setState((prev) => ({ ...prev, ...patch }));
  const BOT_SCOPED_KEYS = new Set<keyof BotProfile>([
    "productName",
    "productType",
    "audience",
    "goal",
    "actionCredentialMode",
    "youtubeUrl",
    "toneProfile",
    "botPersonality",
    "campaignTone",
    "campaignImageCount",
    "campaignImageModel",
    "campaignImageSize",
    "xToken",
    "xApiKey",
    "xApiSecret",
    "xAccessToken",
    "xAccessTokenSecret",
    "discordBotToken",
    "discordInviteUrl",
    "discordChannelName",
    "discordChannelId",
    "discordSeenMessageIds",
    "discordPendingDrafts",
    "discordActiveThreads",
    "discordLearningLog",
    "conversationArtifacts",
    "plan",
    "day",
    "posted",
    "postedTweetIds",
    "views",
    "replies",
    "followers",
    "campaignId",
    "campaignArchive",
  ]);
  const updateBotScoped = (patch: Partial<AppState>) =>
    setState((prev) => {
      const next = { ...prev, ...patch };
      const activeBotId = prev.activeBotId;
      if (!activeBotId) return next;
      const botPatch: Partial<BotProfile> = {};
      for (const key of Object.keys(patch) as Array<keyof AppState>) {
        if (BOT_SCOPED_KEYS.has(key as keyof BotProfile)) {
          (botPatch as Record<string, unknown>)[key] = patch[key] as unknown;
        }
      }
      if (Object.keys(botPatch).length === 0) return next;
      return {
        ...next,
        bots: prev.bots.map((bot) =>
          bot.id === activeBotId ? { ...bot, ...botPatch } : bot,
        ),
      };
    });
  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const saveStateNow = async (next: AppState = state) => {
    const accessToken = session?.access_token ?? "";
    if (!userId || !accessToken) return;
    try {
      const r = await fetch("/api/state/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ state: next }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) setAuthMsg(d.error ?? "cloud save failed.");
    } catch {
      setAuthMsg("cloud save failed.");
    }
  };

  const signUp = async () => {
    if (!supabase) return setAuthMsg("cloud auth is not configured yet.");
    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();
    const name = authName.trim();
    if (!email || !password) return setAuthMsg("add email + password.");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return setAuthMsg(error.message);
    setAuthMsg("account created. check email confirmation if prompted.");
    setAuthMode("signin");
  };

  const signIn = async () => {
    if (!supabase) return setAuthMsg("cloud auth is not configured yet.");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim().toLowerCase(),
      password: authPassword.trim(),
    });
    if (error) return setAuthMsg(error.message);
    setAuthMsg("signed in.");
  };

  const signOut = async () => {
    if (!supabase) return setAuthMsg("cloud auth is not configured yet.");
    setAuthMsg("signing out...");
    try {
      await Promise.race([
        saveStateNow(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("save timeout")), 2000)),
      ]);
    } catch {
      // ignore save failure, continue sign out
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign out failure, still clear local state
    }
    setState(DEFAULT_STATE);
    setSelectedArtifactId(null);
    setAuthMsg("signed out.");
  };

  const clearWorkspaceForNewBot = () => {
    if (!isMasterUser) {
      setAuthMsg("power user access required to create bots.");
      return;
    }
    update({
      activeBotId: null,
      actionCredentialMode: "owner",
      productName: "",
      productType: "",
      audience: "",
      goal: "",
      youtubeUrl: "",
      toneProfile: "direct creator",
      botPersonality: BOT_PERSONALITY,
      campaignTone: "balanced, clear, confident",
      campaignImageCount: 0,
      campaignImageModel: "gpt-image-1",
      campaignImageSize: "1024x1024",
      xToken: "",
      xApiKey: "",
      xApiSecret: "",
      xAccessToken: "",
      xAccessTokenSecret: "",
      discordBotToken: "",
      discordInviteUrl: "https://discord.gg/vCpQWbkD",
      discordChannelName: "i-shipped",
      discordChannelId: "",
      discordSeenMessageIds: [],
      discordPendingDrafts: [],
      discordActiveThreads: [],
      discordLearningLog: [],
      conversationArtifacts: [],
      plan: [],
      day: 1,
      posted: [],
      postedTweetIds: [],
      views: 0,
      replies: 0,
      followers: 0,
      campaignId: newCampaignId(),
    });
    setBotNameInput("");
    setToneMsg("");
    setDiscoverMsg("");
    setEngageMsg("");
    setMetricsMsg("");
    setResults([]);
    setAutomationLog([]);
    setAutomationMsg("new bot draft ready.");
  };

  const saveBotConfig = (forceNew = false) => {
    if (!isMasterUser) {
      setAuthMsg("power user access required to manage bots.");
      return;
    }
    const name = botNameInput.trim() || state.productName.trim();
    if (!name) {
      setAuthMsg("add a bot name or product name first.");
      return;
    }
    const now = new Date().toISOString();
    const nextBot: BotProfile = {
      id: forceNew ? newBotId() : state.activeBotId ?? newBotId(),
      name,
      productName: state.productName,
      productType: state.productType,
      audience: state.audience,
      goal: state.goal,
      actionCredentialMode: state.actionCredentialMode,
      youtubeUrl: state.youtubeUrl,
      toneProfile: state.toneProfile,
      botPersonality: state.botPersonality,
      campaignTone: state.campaignTone,
      campaignImageCount: state.campaignImageCount,
      campaignImageModel: state.campaignImageModel,
      campaignImageSize: state.campaignImageSize,
      xToken: state.xToken,
      xApiKey: state.xApiKey,
      xApiSecret: state.xApiSecret,
      xAccessToken: state.xAccessToken,
      xAccessTokenSecret: state.xAccessTokenSecret,
      discordBotToken: state.discordBotToken,
      discordInviteUrl: state.discordInviteUrl,
      discordChannelName: state.discordChannelName,
      discordChannelId: state.discordChannelId,
      discordSeenMessageIds: state.discordSeenMessageIds,
      discordPendingDrafts: state.discordPendingDrafts,
      discordActiveThreads: state.discordActiveThreads,
      discordLearningLog: state.discordLearningLog,
      conversationArtifacts: state.conversationArtifacts,
      plan: state.plan,
      day: state.day,
      posted: state.posted,
      postedTweetIds: state.postedTweetIds,
      views: state.views,
      replies: state.replies,
      followers: state.followers,
      campaignId: state.campaignId,
      campaignArchive: state.campaignArchive,
      createdAt: activeBot?.createdAt ?? now,
    };
    const exists = state.bots.some((bot) => bot.id === nextBot.id);
    update({
      bots: exists
        ? state.bots.map((bot) => (bot.id === nextBot.id ? nextBot : bot))
        : [nextBot, ...state.bots],
      activeBotId: nextBot.id,
    });
    setBotNameInput(nextBot.name);
    setAuthMsg(
      forceNew || !exists
        ? `created bot "${nextBot.name}".`
        : `updated bot "${nextBot.name}".`,
    );
  };

  const loadBotConfig = (botId: string) => {
    const bot = state.bots.find((item) => item.id === botId);
    if (!bot) return;
    update({
      activeBotId: bot.id,
      productName: bot.productName,
      productType: bot.productType,
      audience: bot.audience,
      goal: bot.goal,
      actionCredentialMode: bot.actionCredentialMode ?? "owner",
      youtubeUrl: bot.youtubeUrl,
      toneProfile: bot.toneProfile,
      botPersonality: bot.botPersonality ?? BOT_PERSONALITY,
      campaignTone: bot.campaignTone ?? "balanced, clear, confident",
      campaignImageCount: bot.campaignImageCount ?? 0,
      campaignImageModel: bot.campaignImageModel ?? "gpt-image-1",
      campaignImageSize: bot.campaignImageSize ?? "1024x1024",
      xToken: bot.xToken,
      xApiKey: bot.xApiKey,
      xApiSecret: bot.xApiSecret,
      xAccessToken: bot.xAccessToken,
      xAccessTokenSecret: bot.xAccessTokenSecret,
      discordBotToken: bot.discordBotToken ?? "",
      discordInviteUrl: bot.discordInviteUrl ?? "https://discord.gg/vCpQWbkD",
      discordChannelName: bot.discordChannelName ?? "i-shipped",
      discordChannelId: bot.discordChannelId ?? "",
      discordSeenMessageIds: bot.discordSeenMessageIds ?? [],
      discordPendingDrafts: bot.discordPendingDrafts ?? [],
      discordActiveThreads: bot.discordActiveThreads ?? [],
      discordLearningLog: bot.discordLearningLog ?? [],
      conversationArtifacts: bot.conversationArtifacts ?? [],
      plan: bot.plan ?? [],
      day: bot.day ?? 1,
      posted: bot.posted ?? [],
      postedTweetIds: bot.postedTweetIds ?? [],
      views: bot.views ?? 0,
      replies: bot.replies ?? 0,
      followers: bot.followers ?? 0,
      campaignId: bot.campaignId ?? newCampaignId(),
      campaignArchive: bot.campaignArchive ?? [],
    });
    setBotNameInput(bot.name);
    setAuthMsg(`loaded bot "${bot.name}".`);
  };

  const updateBotVoice = (
    botId: string,
    patch: Partial<Pick<BotProfile, "youtubeUrl" | "toneProfile" | "botPersonality">>,
  ) => {
    const bot = state.bots.find((item) => item.id === botId);
    if (!bot) return;
    const nextBots = state.bots.map((item) => (item.id === botId ? { ...item, ...patch } : item));
    const statePatch: Partial<AppState> = { bots: nextBots };
    if (state.activeBotId === botId) {
      if (typeof patch.youtubeUrl === "string") statePatch.youtubeUrl = patch.youtubeUrl;
      if (typeof patch.toneProfile === "string") statePatch.toneProfile = patch.toneProfile;
      if (typeof patch.botPersonality === "string") statePatch.botPersonality = patch.botPersonality;
    }
    update(statePatch);
  };

  const analyzeToneForBot = async (botId: string) => {
    const bot = state.bots.find((item) => item.id === botId);
    if (!bot?.youtubeUrl?.trim()) return;
    setToneAnalyzingBotId(botId);
    setToneMsg("analyzing...");
    try {
      const r = await fetch("/api/tone/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: bot.youtubeUrl.trim(),
          openaiApiKey: state.openaiApiKey,
        }),
      });
      const d = (await r.json()) as ToneRes;
      if (!d.ok || !d.tone) {
        setToneMsg(d.error || "tone analysis failed");
        return;
      }
      const tone = `${d.tone.toneName}: ${d.tone.summary}`;
      updateBotVoice(botId, { toneProfile: tone });
      const source = d.source ?? "unknown";
      const warning = d.warning ? ` ${d.warning}` : "";
      setToneMsg(`tone from ${source} in "${d.title}" (${d.wordCount ?? 0} words).${warning}`);
    } catch {
      setToneMsg("tone analysis failed.");
    } finally {
      setToneAnalyzingBotId(null);
    }
  };

  const removeBotConfig = (botId: string) => {
    if (!isMasterUser) {
      setAuthMsg("power user access required to manage bots.");
      return;
    }
    const bot = state.bots.find((item) => item.id === botId);
    const remaining = state.bots.filter((item) => item.id !== botId);
    if (state.activeBotId === botId && remaining.length > 0) {
      const next = remaining[0];
      update({
        bots: remaining,
        activeBotId: next.id,
        productName: next.productName,
        productType: next.productType,
        audience: next.audience,
        goal: next.goal,
        actionCredentialMode: next.actionCredentialMode ?? "owner",
        youtubeUrl: next.youtubeUrl,
        toneProfile: next.toneProfile,
        botPersonality: next.botPersonality ?? BOT_PERSONALITY,
        campaignTone: next.campaignTone ?? "balanced, clear, confident",
        campaignImageCount: next.campaignImageCount ?? 0,
        campaignImageModel: next.campaignImageModel ?? "gpt-image-1",
        campaignImageSize: next.campaignImageSize ?? "1024x1024",
        xToken: next.xToken,
        xApiKey: next.xApiKey,
        xApiSecret: next.xApiSecret,
        xAccessToken: next.xAccessToken,
        xAccessTokenSecret: next.xAccessTokenSecret,
        discordBotToken: next.discordBotToken ?? "",
        discordInviteUrl: next.discordInviteUrl ?? "https://discord.gg/vCpQWbkD",
        discordChannelName: next.discordChannelName ?? "i-shipped",
        discordChannelId: next.discordChannelId ?? "",
        discordSeenMessageIds: next.discordSeenMessageIds ?? [],
        discordPendingDrafts: next.discordPendingDrafts ?? [],
        discordActiveThreads: next.discordActiveThreads ?? [],
        discordLearningLog: next.discordLearningLog ?? [],
        conversationArtifacts: next.conversationArtifacts ?? [],
        plan: next.plan ?? [],
        day: next.day ?? 1,
        posted: next.posted ?? [],
        postedTweetIds: next.postedTweetIds ?? [],
        views: next.views ?? 0,
        replies: next.replies ?? 0,
        followers: next.followers ?? 0,
        campaignId: next.campaignId ?? newCampaignId(),
        campaignArchive: next.campaignArchive ?? [],
      });
      setBotNameInput(next.name);
    } else {
      update({
        bots: remaining,
        activeBotId: state.activeBotId === botId ? null : state.activeBotId,
      });
    }
    setAuthMsg(bot ? `deleted bot "${bot.name}".` : "bot deleted.");
  };

  const generate = async () => {
    if (!selectedArtifact || campaignGenerating) return;
    syncCampaignContextFromArtifact(selectedArtifact);
    if (!state.openaiApiKey.trim()) {
      setAutomationMsg("add your openai api key first.");
      return;
    }
    setCampaignGenerating(true);
    setImageSuggestions([]);
    setAutomationMsg("generating a 14-day plan...");
    setAutomationLog([]);
    try {
      const r = await fetch("/api/campaign/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          campaignTone: state.campaignTone,
          imageCount: state.campaignImageCount,
          productName: selectedArtifact.productName,
          productType: selectedArtifact.productType,
          audience: selectedArtifact.audience,
          intent: selectedArtifact.intent || state.goal,
          summary: selectedArtifact.contextSummary,
          lastMessage: selectedArtifact.lastMessage,
          days: 14,
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; plan?: Day[] };
      if (!d.ok || !d.plan?.length) {
        setAutomationMsg(d.error || "plan generation failed.");
        return;
      }
      const nextPlan = d.plan
        .map((item, idx) => ({
          day: item.day || idx + 1,
          post: (item.post ?? "").trim(),
          play: (item.play ?? "").trim(),
          format: item.format?.trim(),
          pillar: item.pillar?.trim(),
          imageRequired: item.imageRequired ?? false,
          imagePrompt: item.imagePrompt,
        }))
        .filter((item) => item.post && item.play)
        .slice(0, 14)
        .map((item, idx) => ({ ...item, day: item.day || idx + 1 }));
      if (nextPlan.length === 0) {
        setAutomationMsg("plan generation returned empty content.");
        return;
      }
      const archive =
        selectedArtifact.plan.length > 0
          ? [
              {
                id: selectedArtifact.campaignId || newCampaignId(),
                createdAt: new Date().toISOString(),
                productName: selectedArtifact.productName,
                plan: selectedArtifact.plan,
                posted: selectedArtifact.posted,
                postedTweetIds: selectedArtifact.postedTweetIds,
                views: selectedArtifact.views,
                replies: selectedArtifact.replies,
                followers: selectedArtifact.followers,
              },
              ...selectedArtifact.campaignArchive,
            ].slice(0, 20)
          : selectedArtifact.campaignArchive;
      updateConversationArtifact(selectedArtifact.id, {
        plan: nextPlan,
        day: 1,
        posted: [],
        postedTweetIds: [],
        views: 0,
        replies: 0,
        followers: 0,
        campaignId: newCampaignId(),
        campaignArchive: archive,
      });
      setAutomationMsg("new 14-day schedule generated.");
      if (state.campaignImageCount > 0) {
        await generateImagesForPlan(nextPlan, state.campaignImageCount, []);
      }
    } catch {
      setAutomationMsg("plan generation failed.");
    } finally {
      setCampaignGenerating(false);
    }
  };

  const refinePlan = async () => {
    if (!selectedArtifact?.plan.length || planRefining) return;
    syncCampaignContextFromArtifact(selectedArtifact);
    if (!state.openaiApiKey.trim()) {
      setAutomationMsg("add your openai api key first.");
      return;
    }
    setPlanRefining(true);
    setImageSuggestions([]);
    setAutomationMsg("updating plan based on results...");
    try {
      const leanPlan = selectedArtifact.plan.map((item) => ({
        day: item.day,
        post: cleanPostText(item.post).slice(0, 260),
        play: (item.play ?? "").slice(0, 240),
        format: item.format,
        pillar: item.pillar,
      }));
      const r = await fetch("/api/campaign/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          campaignTone: state.campaignTone,
          productName: selectedArtifact.productName,
          productType: selectedArtifact.productType,
          audience: selectedArtifact.audience,
          intent: selectedArtifact.intent || state.goal,
          summary: selectedArtifact.contextSummary,
          plan: leanPlan,
          postedDays: selectedArtifact.posted ?? [],
          metrics: {
            views: selectedArtifact.views ?? 0,
            replies: selectedArtifact.replies ?? 0,
            followers: selectedArtifact.followers ?? 0,
          },
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; plan?: Day[] };
      if (!d.ok || !d.plan?.length) {
        setAutomationMsg(d.error || "plan update failed.");
        return;
      }
      const archive =
        selectedArtifact.plan.length > 0
          ? [
              {
                id: selectedArtifact.campaignId || newCampaignId(),
                createdAt: new Date().toISOString(),
                productName: selectedArtifact.productName,
                plan: selectedArtifact.plan,
                posted: selectedArtifact.posted,
                postedTweetIds: selectedArtifact.postedTweetIds,
                views: selectedArtifact.views,
                replies: selectedArtifact.replies,
                followers: selectedArtifact.followers,
              },
              ...selectedArtifact.campaignArchive,
            ].slice(0, 20)
          : selectedArtifact.campaignArchive;
      const existingByDay = new Map(selectedArtifact.plan.map((item) => [item.day, item]));
      const postedSet = new Set(selectedArtifact.posted ?? []);
      const merged = d.plan.map((item) => {
        const existing = existingByDay.get(item.day);
        if (existing && postedSet.has(item.day)) return existing;
        return {
          ...item,
          format: existing?.format ?? item.format,
          pillar: existing?.pillar ?? item.pillar,
          imageRequired: existing?.imageRequired ?? item.imageRequired,
          images: existing?.images ?? [],
          imagePrompt: existing?.imagePrompt,
          imagePromptOverride: existing?.imagePromptOverride,
        };
      });
      updateConversationArtifact(selectedArtifact.id, { plan: merged, campaignArchive: archive });
      setAutomationMsg("plan updated for remaining days.");
    } catch {
      setAutomationMsg("plan update failed.");
    } finally {
      setPlanRefining(false);
    }
  };

  const generateImagesForPlan = async (
    plan: Day[],
    desiredTotal: number,
    postedDays: number[] = selectedArtifact?.posted ?? [],
  ) => {
    if (!selectedArtifact || imageGenerating) return;
    syncCampaignContextFromArtifact(selectedArtifact);
    if (!state.openaiApiKey.trim()) {
      setAutomationMsg("add your openai api key first.");
      return;
    }
    const safeTotal = Math.min(14, Math.max(0, Math.round(desiredTotal)));
    if (!safeTotal) {
      setAutomationMsg("set how many images to generate first.");
      return;
    }
    const existingCount = plan.filter((item) => (item.images ?? []).length > 0).length;
    const remaining = safeTotal - existingCount;
    if (remaining <= 0) {
      setAutomationMsg("you already have that many images.");
      return;
    }
    const requiredTargets = plan.filter(
      (item) =>
        item.imageRequired &&
        !(item.images ?? []).length &&
        !postedDays.includes(item.day)
    );
    const suggestions = suggestImageDays(plan, remaining, postedDays);
    setImageSuggestions(suggestions);
    const selectedTargets: Array<{ day: number; post: string; play: string; imagePrompt?: string }> = [];
    for (const item of requiredTargets) {
      if (selectedTargets.length >= remaining) break;
      selectedTargets.push({
        day: item.day,
        post: item.post,
        play: item.play,
        imagePrompt: item.imagePromptOverride || item.imagePrompt,
      });
    }
    if (selectedTargets.length < remaining) {
      for (const suggestion of suggestions) {
        if (selectedTargets.length >= remaining) break;
        const planItem = plan.find((p) => p.day === suggestion.day);
        if (!planItem) continue;
        selectedTargets.push({
          day: planItem.day,
          post: planItem.post,
          play: planItem.play,
          imagePrompt: planItem.imagePromptOverride || planItem.imagePrompt,
        });
      }
    }
    if (selectedTargets.length === 0) {
      setAutomationMsg("no eligible days for images right now.");
      return;
    }
    setImageGenerating(true);
    setAutomationMsg(`generating ${selectedTargets.length} image(s)...`);
    try {
      const r = await fetch("/api/campaign/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          model: state.campaignImageModel,
          size: state.campaignImageSize,
          campaignTone: state.campaignTone,
          productName: selectedArtifact.productName,
          productType: selectedArtifact.productType,
          audience: selectedArtifact.audience,
          intent: selectedArtifact.intent || state.goal,
          summary: selectedArtifact.contextSummary,
          items: selectedTargets,
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        images?: Array<{ day: number; url: string; prompt: string }>;
      };
      if (!d.ok || !d.images?.length) {
        setAutomationMsg(d.error || "image generation failed.");
        return;
      }
      const byDay = new Map(d.images.map((img) => [img.day, img]));
      const nextPlan = plan.map((item) => {
        const match = byDay.get(item.day);
        if (!match) return item;
        const nextImages = [...(item.images ?? []), match.url].filter(Boolean);
        return { ...item, images: nextImages, imagePrompt: match.prompt || item.imagePrompt };
      });
      updateConversationArtifact(selectedArtifact.id, { plan: nextPlan });
      setAutomationMsg(`generated ${d.images.length} image(s).`);
    } catch {
      setAutomationMsg("image generation failed.");
    } finally {
      setImageGenerating(false);
    }
  };

  const generateImageForDay = async (day: number) => {
    if (!selectedArtifact || imageGenerating) return;
    syncCampaignContextFromArtifact(selectedArtifact);
    if (!state.openaiApiKey.trim()) {
      setAutomationMsg("add your openai api key first.");
      return;
    }
    const planItem = selectedArtifact.plan.find((item) => item.day === day);
    if (!planItem) {
      setAutomationMsg("no plan found for that day.");
      return;
    }
    setImageGenerating(true);
    setAutomationMsg(`generating image for day ${day}...`);
    try {
      const r = await fetch("/api/campaign/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          model: state.campaignImageModel,
          size: state.campaignImageSize,
          campaignTone: state.campaignTone,
          productName: selectedArtifact.productName,
          productType: selectedArtifact.productType,
          audience: selectedArtifact.audience,
          intent: selectedArtifact.intent || state.goal,
          summary: selectedArtifact.contextSummary,
          items: [
            {
              day: planItem.day,
              post: planItem.post,
              play: planItem.play,
              imagePrompt: planItem.imagePromptOverride || planItem.imagePrompt,
            },
          ],
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        images?: Array<{ day: number; url: string; prompt: string }>;
      };
      if (!d.ok || !d.images?.length) {
        setAutomationMsg(d.error || "image generation failed.");
        return;
      }
      const match = d.images.find((img) => img.day === day) ?? d.images[0];
      const nextPlan = selectedArtifact.plan.map((item) => {
        if (item.day !== day) return item;
        const nextImages = [...(item.images ?? []), match.url].filter(Boolean);
        return { ...item, images: nextImages, imagePrompt: match.prompt || item.imagePrompt };
      });
      updateConversationArtifact(selectedArtifact.id, { plan: nextPlan });
      setAutomationMsg(`image generated for day ${day}.`);
    } catch {
      setAutomationMsg("image generation failed.");
    } finally {
      setImageGenerating(false);
    }
  };

  const updateDayImagePrompt = (day: number, value: string) => {
    if (!selectedArtifact) return;
    const nextPlan = selectedArtifact.plan.map((item) =>
      item.day === day ? { ...item, imagePromptOverride: value } : item,
    );
    updateConversationArtifact(selectedArtifact.id, { plan: nextPlan });
  };

  const runDay = () => {
    if (!selectedArtifact?.plan.length) return;
    const d = selectedArtifact.day;
    updateConversationArtifact(selectedArtifact.id, { day: Math.min(14, d + 1) });
  };

  const searchQuery = useMemo(() => {
    const parts = [
      selectedArtifact?.productName ?? state.productName,
      selectedArtifact?.productType ?? state.productType,
      selectedArtifact?.audience ?? state.audience,
    ]
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.join(" ");
  }, [
    selectedArtifact?.productName,
    selectedArtifact?.productType,
    selectedArtifact?.audience,
    state.productName,
    state.productType,
    state.audience,
  ]);

  const markPosted = () => {
    if (!selectedArtifact || !today) return;
    if (selectedArtifact.posted.includes(selectedArtifact.day)) return;
    updateConversationArtifact(selectedArtifact.id, {
      posted: [...selectedArtifact.posted, selectedArtifact.day].sort((a, b) => a - b),
    });
  };

  const publish = async () => {
    if (!selectedArtifact || !today || publishing) return;
    setPublishing(true);
    setResults([]);
    try {
      const r = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: todayCleanPost,
          images: today?.images ?? [],
          campaignId: selectedArtifact.campaignId,
          day: selectedArtifact.day,
          platforms: ["x"],
          connections: activeConnections,
        }),
      });
      const d = (await r.json()) as { results?: PublishRes[] };
      const next = d.results ?? [];
      setResults(next);
      if (next.some((item) => item.ok)) {
        const nextPosted = selectedArtifact.posted.includes(selectedArtifact.day)
          ? selectedArtifact.posted
          : [...selectedArtifact.posted, selectedArtifact.day].sort((a, b) => a - b);
        const ids = next.map((item) => item.postId).filter((id): id is string => Boolean(id));
        const nextPostedIds = ids.length
          ? Array.from(new Set([...selectedArtifact.postedTweetIds, ...ids]))
          : selectedArtifact.postedTweetIds;
        updateConversationArtifact(selectedArtifact.id, {
          posted: nextPosted,
          postedTweetIds: nextPostedIds,
          day: Math.min(14, selectedArtifact.day + 1),
        });
      }
    } catch {
      setResults([{ platform: "x", ok: false, message: "publish failed." }]);
    } finally {
      setPublishing(false);
    }
  };

  const publishDay = async (day: number) => {
    if (!selectedArtifact || publishing) return;
    const planItem = selectedArtifact.plan.find((item) => item.day === day);
    if (!planItem) {
      setAutomationMsg("no plan found for that day.");
      return;
    }
    setPublishing(true);
    setResults([]);
    try {
      const r = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanPostText(planItem.post),
          images: planItem.images ?? [],
          campaignId: selectedArtifact.campaignId,
          day,
          platforms: ["x"],
          connections: activeConnections,
        }),
      });
      const d = (await r.json()) as { results?: PublishRes[] };
      const next = d.results ?? [];
      setResults(next);
      if (next.some((item) => item.ok)) {
        const nextPosted = selectedArtifact.posted.includes(day)
          ? selectedArtifact.posted
          : [...selectedArtifact.posted, day].sort((a, b) => a - b);
        const ids = next.map((item) => item.postId).filter((id): id is string => Boolean(id));
        const nextPostedIds = ids.length
          ? Array.from(new Set([...selectedArtifact.postedTweetIds, ...ids]))
          : selectedArtifact.postedTweetIds;
        updateConversationArtifact(selectedArtifact.id, {
          posted: nextPosted,
          postedTweetIds: nextPostedIds,
        });
      }
    } catch {
      setResults([{ platform: "x", ok: false, message: "publish failed." }]);
    } finally {
      setPublishing(false);
    }
  };

  const refreshRealMetrics = async () => {
    if (!hasActionX) {
      setMetricsMsg(
        activeCredentialMode === "owner"
          ? "connect owner x credentials first."
          : "connect product x credentials first.",
      );
      return;
    }
    setMetricsLoading(true);
    setMetricsMsg("syncing live metrics...");
    try {
      const r = await fetch("/api/social/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetIds: selectedArtifact?.postedTweetIds ?? [],
          connections: activeConnections,
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        source?: string;
        account?: string;
        warning?: string | null;
        metrics?: { views?: number; replies?: number; followers?: number };
      };
      if (!d.ok || !d.metrics) {
        setMetricsMsg(d.error ?? "could not load live metrics.");
        return;
      }
      if (selectedArtifact) {
        updateConversationArtifact(selectedArtifact.id, {
          views: d.metrics.views ?? 0,
          replies: d.metrics.replies ?? 0,
          followers: d.metrics.followers ?? 0,
        });
      }
      const warning = d.warning ? ` ${d.warning}` : "";
      setMetricsMsg(`live metrics synced from ${d.account ?? "x account"} (${d.source ?? "x"}).${warning}`);
    } catch {
      setMetricsMsg("metrics sync failed.");
    } finally {
      setMetricsLoading(false);
    }
  };

  const discoverRelevantPosts = async () => {
    if (!hasActionX || !searchQuery) return;
    setDiscovering(true);
    setDiscoverMsg("finding relevant posts...");
    try {
      const r = await fetch("/api/social/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          productName: selectedArtifact?.productName ?? state.productName,
          productType: selectedArtifact?.productType ?? state.productType,
          audience: selectedArtifact?.audience ?? state.audience,
          maxResults: 10,
          connections: activeConnections,
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; posts?: DiscoverPost[] };
      if (!d.ok) {
        setDiscoverMsg(d.error ?? "discover failed");
        return;
      }
      const posts = d.posts ?? [];
      setDiscoveredPosts(posts);
      setDiscoverMsg(`found ${posts.length} relevant posts`);
    } catch {
      setDiscoverMsg("discover failed");
    } finally {
      setDiscovering(false);
    }
  };

  const autoCommentTopPosts = async () => {
    if (!hasActionX || !searchQuery || engaging) return;
    setEngaging(true);
    setEngageMsg("posting replies...");
    try {
      const r = await fetch("/api/social/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          productName: selectedArtifact?.productName || state.productName,
          audience: selectedArtifact?.audience || state.audience,
          openaiApiKey: state.openaiApiKey,
          maxReplies: 2,
          connections: activeConnections,
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        repliedCount?: number;
        attempted?: number;
      };
      if (!d.ok) {
        setEngageMsg(d.error ?? "auto-comment failed");
        return;
      }
      setEngageMsg(`auto-commented ${d.repliedCount ?? 0}/${d.attempted ?? 0} relevant posts`);
    } catch {
      setEngageMsg("auto-comment failed");
    } finally {
      setEngaging(false);
    }
  };

  const executeTodayAutomation = async () => {
    if (!today) return;
    setAutomationRunning(true);
    setAutomationMsg(`running day ${state.day} automation...`);
    setAutomationLog([
      "queued: publish today post",
      "queued: auto-comment relevant posts",
      "queued: sync live metrics",
    ]);
    try {
      await publish();
      setAutomationLog((prev) => [...prev, "done: publish step finished"]);
      await autoCommentTopPosts();
      setAutomationLog((prev) => [...prev, "done: engagement step finished"]);
      await refreshRealMetrics();
      setAutomationLog((prev) => [...prev, "done: metrics step finished"]);
      setAutomationMsg("today automation finished.");
    } finally {
      setAutomationRunning(false);
    }
  };

  const syncDiscordApprovals = async () => {
    if (!state.discordBotToken.trim()) {
      setDiscordMsg("add a discord bot token first.");
      return;
    }
    setDiscordSyncing(true);
    setDiscordMsg("scanning discord...");
    try {
      const r = await fetch("/api/discord/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: state.discordBotToken,
          inviteUrl: state.discordInviteUrl,
          channelName: state.discordChannelName,
          channelId: state.discordChannelId,
          seenMessageIds: state.discordSeenMessageIds,
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        warning?: string;
        rateLimited?: boolean;
        channelId?: string;
        channelName?: string;
        drafts?: DiscordDraft[];
        stats?: { threadCount?: number; messageCount?: number; postCount?: number };
      };
      if (!d.ok) {
        setDiscordMsg(d.error ?? "discord scan failed.");
        return;
      }
      if (d.rateLimited) {
        setDiscordMsg(d.warning ?? "discord is rate-limiting scans. wait a bit and retry.");
        return;
      }

      const existingById = new Map(
        [...state.discordPendingDrafts, ...state.discordActiveThreads].map((item) => [
          item.draftId,
          item,
        ]),
      );
      const incoming = (d.drafts ?? []).map((item) => {
        const existing = existingById.get(item.draftId);
        if (!existing) return item;
        return {
          ...item,
          replyText: item.replyText?.trim() ? item.replyText : existing.replyText,
          learning: item.learning.length > 0 ? item.learning : existing.learning,
        };
      });
      const pending = incoming.filter((item) => {
        const status = item.status ?? "needs_reply";
        return status === "needs_reply" || status === "needs_followup";
      });
      const active = incoming.filter((item) => {
        const status = item.status ?? "waiting";
        return status === "waiting" || status === "active";
      });
      const previousArtifacts = new Map(
        state.conversationArtifacts.map((item) => [item.draftId, item]),
      );
      const artifactMap = new Map<string, ConversationArtifact>();
      for (const item of incoming) {
        const prev = previousArtifacts.get(item.draftId);
        artifactMap.set(item.draftId, buildArtifactFromDraft(item, prev));
      }
      for (const [draftId, artifact] of previousArtifacts.entries()) {
        if (!artifactMap.has(draftId)) {
          artifactMap.set(draftId, artifact);
        }
      }
      const mergedArtifacts = Array.from(artifactMap.values())
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 300);
      const seedArtifact =
        mergedArtifacts.find((item) => item.productName || item.audience || item.productType) ?? null;

      updateBotScoped({
        discordChannelId: d.channelId ?? state.discordChannelId,
        discordChannelName: d.channelName ?? state.discordChannelName,
        discordPendingDrafts: pending.slice(0, 100),
        discordActiveThreads: active.slice(0, 100),
        conversationArtifacts: mergedArtifacts,
        productName:
          seedArtifact?.productName ||
          state.productName ||
          (state.productName || botNameInput || "my project"),
        productType: seedArtifact?.productType || state.productType || state.productType,
        audience: seedArtifact?.audience || state.audience || state.audience,
        goal: seedArtifact?.intent || state.goal,
      });
      if (mergedArtifacts.length > 0) {
        setSelectedArtifactId(mergedArtifacts[0].id);
      }
      setDiscordMsg(
        incoming.length > 0
          ? `scanned ${incoming.length} threads. new: ${pending.filter((i) => (i.status ?? "needs_reply") === "needs_reply").length}, follow-up: ${pending.filter((i) => i.status === "needs_followup").length}, waiting: ${active.length}.`
          : `no posts found. scanned ${d.stats?.threadCount ?? 0} thread(s), ${d.stats?.messageCount ?? 0} message(s).`,
      );
    } catch {
      setDiscordMsg("discord scan failed.");
    } finally {
      setDiscordSyncing(false);
    }
  };

  const generateDiscordReplies = async () => {
    if (!state.openaiApiKey.trim()) {
      setDiscordMsg("add your openai api key first.");
      return;
    }
    const targets = state.discordPendingDrafts.filter((draft) => !draft.replyText.trim());
    if (targets.length === 0) {
      setDiscordMsg("no new drafts to generate right now.");
      return;
    }
    setDiscordGenerating(true);
    setDiscordMsg(`generating replies for ${targets.length} thread(s)...`);
    try {
      const artifactByDraftId = new Map(
        state.conversationArtifacts.map((artifact) => [artifact.draftId, artifact]),
      );
      const checkpointByDraftId = new Map<
        string,
        {
          summary: string;
          capturedUntilMessageId: string;
          capturedMessageCount: number;
          lastMessage: string;
          productName: string;
          productType: string;
          audience: string;
          intent: string;
        }
      >();
      for (const draft of targets) {
        const condensed = buildCondensedContextFromMessages(draft.threadMessages ?? []);
        checkpointByDraftId.set(draft.draftId, condensed);
      }
      const r = await fetch("/api/discord/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          toneProfile: state.toneProfile,
          drafts: targets.map((draft) => {
            const artifact = artifactByDraftId.get(draft.draftId);
            const checkpoint = checkpointByDraftId.get(draft.draftId);
            return {
              ...draft,
              artifactContext: {
                productName: checkpoint?.productName || artifact?.productName || "",
                productType: checkpoint?.productType || artifact?.productType || "",
                audience: checkpoint?.audience || artifact?.audience || "",
                intent: checkpoint?.intent || artifact?.intent || "",
                summary: checkpoint?.summary || artifact?.contextSummary || "",
              },
              messagesSinceCheckpoint: getMessagesSinceCheckpoint(
                draft.threadMessages ?? [],
                artifact?.contextCapturedUntilMessageId ?? "",
              ),
              contextCapturedUntilMessageId:
                checkpoint?.capturedUntilMessageId || artifact?.contextCapturedUntilMessageId,
              contextCapturedMessageCount:
                checkpoint?.capturedMessageCount || artifact?.contextCapturedMessageCount || 0,
            };
          }),
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; drafts?: DiscordDraft[] };
      if (!d.ok) {
        setDiscordMsg(d.error ?? "could not generate replies.");
        return;
      }
      const generated = new Map((d.drafts ?? []).map((draft) => [draft.draftId, draft]));
      const nextPending = state.discordPendingDrafts.map((draft) => {
        const next = generated.get(draft.draftId);
        return next
          ? {
              ...draft,
              replyText: next.replyText,
              learning: next.learning,
            }
          : draft;
      });
      const nextArtifacts = state.conversationArtifacts.map((artifact) => {
        const checkpoint = checkpointByDraftId.get(artifact.draftId);
        if (!checkpoint) return artifact;
        return {
          ...artifact,
          productName: checkpoint.productName || artifact.productName,
          productType: checkpoint.productType || artifact.productType,
          audience: checkpoint.audience || artifact.audience,
          intent: checkpoint.intent || artifact.intent,
          contextSummary: checkpoint.summary || artifact.contextSummary,
          contextCapturedUntilMessageId:
            checkpoint.capturedUntilMessageId || artifact.contextCapturedUntilMessageId,
          contextCapturedMessageCount:
            checkpoint.capturedMessageCount || artifact.contextCapturedMessageCount,
          lastMessage: checkpoint.lastMessage || artifact.lastMessage,
          updatedAt: new Date().toISOString(),
        };
      });
      updateBotScoped({ discordPendingDrafts: nextPending, conversationArtifacts: nextArtifacts });
      setDiscordMsg(`generated ${generated.size} reply draft(s).`);
    } catch {
      setDiscordMsg("could not generate replies.");
    } finally {
      setDiscordGenerating(false);
    }
  };

  const refreshDiscordDraftReply = async (
    draft: DiscordDraft,
    bucket: "pending" | "active",
  ) => {
    if (!state.openaiApiKey.trim()) {
      setDiscordMsg("add your openai api key first.");
      return;
    }
    const artifact = state.conversationArtifacts.find((item) => item.draftId === draft.draftId);
    const checkpointChanged =
      (artifact?.contextCapturedUntilMessageId ?? "") !==
      (draft.lastConversationMessageId ?? "");
    if (!checkpointChanged) {
      setDiscordMsg("no new messages since last checkpoint. context and reply are up to date.");
      return;
    }

    setDiscordPostingDraftId(draft.draftId);
    setDiscordMsg("new messages detected, updating context and refreshing reply...");
    try {
        const condensed = buildCondensedContextFromMessages(draft.threadMessages ?? []);
        const r = await fetch("/api/discord/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          openaiApiKey: state.openaiApiKey,
          toneProfile: state.toneProfile,
          refresh: true,
          drafts: [
            {
              ...draft,
              artifactContext: {
                productName: condensed.productName || artifact?.productName || "",
                productType: condensed.productType || artifact?.productType || "",
                audience: condensed.audience || artifact?.audience || "",
                intent: condensed.intent || artifact?.intent || "",
                summary: condensed.summary || artifact?.contextSummary || "",
              },
              messagesSinceCheckpoint: getMessagesSinceCheckpoint(
                draft.threadMessages ?? [],
                artifact?.contextCapturedUntilMessageId ?? "",
              ),
              contextCapturedUntilMessageId:
                condensed.capturedUntilMessageId || artifact?.contextCapturedUntilMessageId,
              contextCapturedMessageCount:
                condensed.capturedMessageCount || artifact?.contextCapturedMessageCount || 0,
            },
          ],
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; drafts?: DiscordDraft[] };
      if (!d.ok || !(d.drafts?.length)) {
        setDiscordMsg(d.error ?? "could not refresh reply.");
        return;
      }
      const nextDraft = d.drafts[0];
      if (bucket === "pending") {
        updateBotScoped({
          discordPendingDrafts: state.discordPendingDrafts.map((item) =>
            item.draftId === draft.draftId
              ? { ...item, replyText: nextDraft.replyText, learning: nextDraft.learning }
              : item,
          ),
        });
      } else {
        updateBotScoped({
          discordActiveThreads: state.discordActiveThreads.map((item) =>
            item.draftId === draft.draftId
              ? { ...item, replyText: nextDraft.replyText, learning: nextDraft.learning }
              : item,
          ),
        });
      }
      updateBotScoped({
        conversationArtifacts: state.conversationArtifacts.map((item) =>
          item.draftId === draft.draftId
            ? {
                ...item,
                productName: condensed.productName || item.productName,
                productType: condensed.productType || item.productType,
                audience: condensed.audience || item.audience,
                intent: condensed.intent || item.intent,
                contextSummary: condensed.summary || item.contextSummary,
                contextCapturedUntilMessageId:
                  condensed.capturedUntilMessageId || item.contextCapturedUntilMessageId,
                contextCapturedMessageCount:
                  condensed.capturedMessageCount || item.contextCapturedMessageCount,
                lastMessage: condensed.lastMessage || item.lastMessage,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      });
      setDiscordMsg("new messages detected. context updated and reply refreshed.");
    } catch {
      setDiscordMsg("could not refresh reply.");
    } finally {
      setDiscordPostingDraftId(null);
    }
  };

  const approveDiscordDraft = async (draftId: string) => {
    const draft = state.discordPendingDrafts.find((item) => item.draftId === draftId);
    if (!draft) return;
    const targetChannelId = (draft.sourceChannelId ?? "").trim() || state.discordChannelId.trim();
    if (!state.discordBotToken.trim() || !targetChannelId) {
      setDiscordMsg("missing discord bot token or channel id.");
      return;
    }
    setDiscordPostingDraftId(draftId);
    setDiscordMsg("posting approved reply...");
    try {
      const r = await fetch("/api/discord/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: state.discordBotToken,
          channelId: targetChannelId,
          sourceMessageId: draft.sourceMessageId,
          replyText: draft.replyText,
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) {
        setDiscordMsg(d.error ?? "could not post approved reply.");
        return;
      }
      updateBotScoped({
        discordPendingDrafts: state.discordPendingDrafts.filter((item) => item.draftId !== draftId),
        discordActiveThreads: [
          { ...draft, status: "waiting" as const },
          ...state.discordActiveThreads.filter((item) => item.draftId !== draftId),
        ].slice(0, 100),
        conversationArtifacts: state.conversationArtifacts.map((item) =>
          item.draftId === draftId
            ? {
                ...item,
                status: "waiting",
                lastMessage: draft.replyText || item.lastMessage,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
        discordSeenMessageIds: Array.from(
          new Set([...state.discordSeenMessageIds, draft.sourceMessageId]),
        ).slice(-500),
        discordLearningLog: [
          { at: new Date().toISOString(), sourceMessageId: draft.sourceMessageId, notes: draft.learning },
          ...state.discordLearningLog,
        ].slice(0, 120),
      });
      setDiscordViewTab("active");
      setDiscordMsg("approved reply posted.");
    } catch {
      setDiscordMsg("could not post approved reply.");
    } finally {
      setDiscordPostingDraftId(null);
    }
  };

  const updateDiscordDraftReply = (draftId: string, replyText: string) => {
    updateBotScoped({
      discordPendingDrafts: state.discordPendingDrafts.map((draft) =>
        draft.draftId === draftId ? { ...draft, replyText } : draft,
      ),
    });
  };

  const updateActiveDraftReply = (draftId: string, replyText: string) => {
    updateBotScoped({
      discordActiveThreads: state.discordActiveThreads.map((draft) =>
        draft.draftId === draftId ? { ...draft, replyText } : draft,
      ),
    });
  };

  const updateConversationArtifact = (
    artifactId: string,
    patch: Partial<ConversationArtifact>,
  ) => {
    updateBotScoped({
      conversationArtifacts: state.conversationArtifacts.map((artifact) =>
        artifact.id === artifactId
          ? { ...artifact, ...patch, updatedAt: new Date().toISOString() }
          : artifact,
      ),
    });
  };

  const syncCampaignContextFromArtifact = (artifact?: ConversationArtifact | null) => {
    if (!artifact) return;
    updateBotScoped({
      productName: artifact.productName || state.productName,
      productType: artifact.productType || state.productType,
      audience: artifact.audience || state.audience,
      goal: artifact.intent || state.goal,
    });
  };

  const replyToActiveDiscordThread = async (draftId: string) => {
    const draft = state.discordActiveThreads.find((item) => item.draftId === draftId);
    if (!draft) return;
    const targetChannelId = (draft.sourceChannelId ?? "").trim() || state.discordChannelId.trim();
    if (!state.discordBotToken.trim() || !targetChannelId) {
      setDiscordMsg("missing discord bot token or channel id.");
      return;
    }
    if (!draft.replyText.trim()) {
      setDiscordMsg("add a reply before posting.");
      return;
    }
    setDiscordPostingDraftId(draftId);
    setDiscordMsg("posting reply in active conversation...");
    try {
      const r = await fetch("/api/discord/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: state.discordBotToken,
          channelId: targetChannelId,
          sourceMessageId: draft.sourceMessageId,
          replyText: draft.replyText,
        }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) {
        setDiscordMsg(d.error ?? "could not post active reply.");
        return;
      }
      updateBotScoped({
        conversationArtifacts: state.conversationArtifacts.map((item) =>
          item.draftId === draftId
            ? {
                ...item,
                status: "waiting",
                lastMessage: draft.replyText || item.lastMessage,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      });
      setDiscordMsg("active reply posted.");
    } catch {
      setDiscordMsg("could not post active reply.");
    } finally {
      setDiscordPostingDraftId(null);
    }
  };

  if (!state.started) {
    const identities = [
      {
        title: "founders",
        line: "be the expert when your market is asking questions.",
      },
      {
        title: "musicians",
        line: "show up in the conversations your future fans are already in.",
      },
      {
        title: "creators",
        line: "stay visible in your niche without living on the app.",
      },
      {
        title: "personal brands",
        line: "build trust at scale without losing your voice.",
      },
    ];
    const steps = [
      {
        title: "step 1 - define",
        line: "tell mymic about your brand, product, or sound. set your audience and goals.",
      },
      {
        title: "step 2 - connect",
        line: "link your twitter/x account. mymic scans your niche in real time for moments that matter.",
      },
      {
        title: "step 3 - grow",
        line: "mymic engages in your voice, publishes on schedule, and tracks what works in one dashboard.",
      },
    ];
    const features = [
      "real-time conversation scanner",
      "authentic voice engine",
      "smart auto-engagement",
      "14-day campaign engine",
      "unified growth dashboard",
      "human-in-the-loop control",
    ];

    return (
      <main className="relative min-h-screen overflow-hidden px-6 py-10 sm:px-10">
        <div className="cyber-mesh pointer-events-none fixed inset-0 -z-20" />
        <div className="cyber-noise pointer-events-none fixed inset-0 -z-10" />
        <div
          className="pointer-events-none fixed z-40 h-4 w-4 rounded-full bg-[var(--glow-pink)] opacity-80 blur-[1px]"
          style={{ transform: `translate(${cursor.x - 8}px, ${cursor.y - 8}px)` }}
        />
        <div className="mx-auto max-w-6xl space-y-24 text-[var(--text-primary)]">
          <section className="cyber-float pt-8" style={{ "--delay": "40ms" } as CSSProperties}>
            <p className="font-[family-name:var(--font-manrope)] text-xs uppercase tracking-[0.26em] text-[var(--text-dim)]">
              mymic ai
            </p>
            <h1 className="mt-4 max-w-5xl font-[family-name:var(--font-instrument-serif)] text-4xl uppercase leading-tight [text-shadow:0_0_20px_color-mix(in_srgb,var(--glow-pink)_35%,transparent)] sm:text-6xl">
              your product is good. your distribution is broken.
            </h1>
            <p className="mt-6 max-w-3xl text-base text-[var(--text-primary)]/85 sm:text-lg">
              mymic ai scans twitter in real time, finds the conversations happening in your
              world, and gets you into them in your voice so the right people discover you,
              naturally.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                color="secondary"
                size="lg"
                onPress={() => {
                  update({ started: true, selectedTab: "product" });
                }}
              >
                get early access
              </Button>
              <Button color="secondary" variant="bordered" size="lg" onPress={() => jumpTo("how-it-works")}>
                see how it works
              </Button>
            </div>
          </section>

          <section className="cyber-float" style={{ "--delay": "90ms" } as CSSProperties}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {identities.map((item) => (
                <Card key={item.title} className="cyber-card" shadow="none">
                  <CardBody className="gap-2">
                    <p className="font-[family-name:var(--font-instrument-serif)] text-sm uppercase tracking-[0.18em]">
                      {item.title}
                    </p>
                    <p className="text-sm text-[var(--text-primary)]/85">{item.line}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="cyber-float text-center" style={{ "--delay": "130ms" } as CSSProperties}>
            <div className="mymic-divider mx-auto mb-8 max-w-3xl" />
            <p className="mx-auto max-w-4xl text-lg leading-relaxed sm:text-2xl">
              everyone is posting. almost nobody is present. the people who grow fastest
              aren&apos;t the loudest, they show up in the right conversation at the right moment.
              now that advantage is automated.
            </p>
            <div className="mymic-divider mx-auto mt-8 max-w-3xl" />
          </section>

          <section id="how-it-works" className="cyber-float" style={{ "--delay": "170ms" } as CSSProperties}>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-2xl uppercase sm:text-4xl">
              how it works
            </h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {steps.map((step, i) => (
                <Card key={step.title} className="cyber-card cyber-float" shadow="none" style={{ "--delay": `${240 + i * 70}ms` } as CSSProperties}>
                  <CardBody className="gap-2">
                    <p className="font-[family-name:var(--font-instrument-serif)] text-sm uppercase tracking-[0.15em]">
                      {step.title}
                    </p>
                    <p className="text-sm text-[var(--text-primary)]/85">{step.line}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="cyber-float" style={{ "--delay": "210ms" } as CSSProperties}>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-2xl uppercase sm:text-4xl">
              core features
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature} className="cyber-card" shadow="none">
                  <CardBody>
                    <p className="font-[family-name:var(--font-manrope)] text-sm uppercase tracking-[0.12em] text-[var(--text-primary)]/90">
                      {feature}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="cyber-float" style={{ "--delay": "250ms" } as CSSProperties}>
            <Card className="cyber-card overflow-hidden" shadow="none">
              <CardBody className="gap-4 py-12 text-center">
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  always on
                </p>
                <p className="mx-auto max-w-4xl font-[family-name:var(--font-instrument-serif)] text-xl uppercase leading-relaxed sm:text-3xl">
                  while you&apos;re building, mymic is watching. while you&apos;re sleeping, mymic is
                  present.
                </p>
                <p className="text-[var(--text-primary)]/80">
                  your audience is growing before you open your eyes.
                </p>
              </CardBody>
            </Card>
          </section>

          <section className="cyber-float text-center" style={{ "--delay": "290ms" } as CSSProperties}>
            <p className="font-[family-name:var(--font-manrope)] text-sm uppercase tracking-[0.18em] text-[var(--text-dim)]">
              built for people who ship. trusted by builders who don&apos;t have time to be everywhere.
            </p>
          </section>

          <section className="cyber-float pb-8 text-center" style={{ "--delay": "330ms" } as CSSProperties}>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-3xl uppercase [text-shadow:0_0_24px_color-mix(in_srgb,var(--glow-purple)_40%,transparent)] sm:text-5xl">
              your audience is already out there. they just haven&apos;t found you yet.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--text-primary)]/85">
              mymic ai changes that. starting today.
            </p>
            <Button
              className="mt-8"
              color="secondary"
              size="lg"
                onPress={() => {
                  update({ started: true, selectedTab: "product" });
                }}
              >
              join the waitlist - it&apos;s free
            </Button>
          </section>

          <footer className="cyber-float border-t border-[color:color-mix(in_srgb,var(--glow-purple)_20%,transparent)] py-8 text-sm text-[var(--text-dim)]" style={{ "--delay": "360ms" } as CSSProperties}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-[family-name:var(--font-instrument-serif)] uppercase">mymic ai</p>
              <p>built for builders who ship.</p>
            </div>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10 sm:px-10">
      <div className="cyber-mesh pointer-events-none fixed inset-0 -z-20" />
      <div className="cyber-noise pointer-events-none fixed inset-0 -z-10" />
      <div className="mx-auto grid max-w-7xl gap-6 text-[var(--text-primary)] lg:grid-cols-[250px_minmax(0,1fr)]">
        <Card className="cyber-card h-fit lg:sticky lg:top-6" shadow="none">
          <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">
            menu
          </CardHeader>
          <CardBody className="gap-2">
            <Button className="justify-start" color="secondary" variant="flat" onPress={() => update({ started: false })}>
              Home
            </Button>
            {isMasterUser && (
              <Button
                className="justify-start"
                color="secondary"
                variant={selectedTab === "power" ? "solid" : "flat"}
                onPress={() => {
                  update({ selectedTab: "power" });
                  jumpTo("workflow-section");
                }}
              >
                Power User
              </Button>
            )}
            <p className="pt-3 text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">Workflow</p>
            <Button
              className="justify-start"
              color="secondary"
              variant={selectedTab === "product" ? "solid" : "flat"}
              onPress={() => {
                update({ selectedTab: "product" });
                jumpTo("workflow-section");
              }}
            >
              Product
            </Button>
            <Button
              className="justify-start"
              color="secondary"
              variant={selectedTab === "connections" ? "solid" : "flat"}
              onPress={() => {
                update({ selectedTab: "connections" });
                jumpTo("workflow-section");
              }}
            >
              Connections
            </Button>
            <Button
              className="justify-start"
              color="secondary"
              variant={selectedTab === "actions" ? "solid" : "flat"}
              onPress={() => {
                update({ selectedTab: "actions" });
                jumpTo("workflow-section");
              }}
            >
              Actions
            </Button>
            <div className="mt-3 rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_20%,transparent)] bg-black/25 p-3 text-xs">
              <p className="uppercase tracking-[0.14em] text-[var(--text-dim)]">Campaign</p>
              <p className="mt-1 text-[var(--text-primary)]">
                {hasActionX ? "ready" : "needs selected x connection"}
              </p>
              <p className="text-[var(--text-dim)]">posted {postedCount}/14</p>
            </div>
          </CardBody>
        </Card>
        <div>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-manrope)] text-xs uppercase tracking-[0.26em] text-[var(--text-dim)]">
              mymic ai
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl uppercase sm:text-5xl">
              growth console
            </h1>
          </div>
          <Button
            color="secondary"
            variant="flat"
            aria-label="open account"
            onPress={() => setAccountOpen(true)}
            className="font-[family-name:var(--font-manrope)]"
          >
            ACCOUNT
          </Button>
        </div>

        <Card className="cyber-card mb-6" shadow="none">
          <CardBody className="gap-2 text-sm">
            <p className="font-[family-name:var(--font-instrument-serif)] uppercase">quick guide</p>
            <p className="text-[var(--text-primary)]/85">
              as power user, create one autonomous bot per project, then run publishing +
              engagement and track traction.
            </p>
          </CardBody>
        </Card>

        <Tabs
          id="workflow-section"
          color="secondary"
          variant="underlined"
          selectedKey={selectedTab}
          onSelectionChange={(key) =>
            update({
              selectedTab: String(key) as "power" | "product" | "connections" | "actions",
            })
          }
          classNames={{ tab: "font-[family-name:var(--font-manrope)] uppercase tracking-wider" }}
        >
          {isMasterUser && (
            <Tab key="power" title="Power User">
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <Card className="cyber-card lg:col-span-2" shadow="none">
                  <CardHeader className="pb-0">
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-[family-name:var(--font-instrument-serif)] uppercase">
                        project bots
                      </span>
                      <Button
                        size="sm"
                        color="secondary"
                        variant={showBotControls ? "flat" : "solid"}
                        onPress={() => {
                          if (!showBotControls) clearWorkspaceForNewBot();
                          setShowBotControls((prev) => !prev);
                        }}
                        isDisabled={!session || !isMasterUser}
                      >
                        {showBotControls ? "close" : "add bot"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="gap-3 text-sm">
                    {showBotControls && (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="mb-2 font-[family-name:var(--font-instrument-serif)] text-xs uppercase text-[var(--text-dim)]">
                          bot controls
                        </p>
                        <Input
                          label="bot name"
                          value={botNameInput}
                          onValueChange={setBotNameInput}
                          isDisabled={!session || !isMasterUser}
                        />
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Button
                            color="secondary"
                            onPress={() => saveBotConfig(true)}
                            isDisabled={!session || !isMasterUser}
                          >
                            create new bot
                          </Button>
                          <Button
                            color="secondary"
                            variant="flat"
                            onPress={() => saveBotConfig(false)}
                            isDisabled={!session || !isMasterUser || !state.activeBotId}
                          >
                            save changes
                          </Button>
                          <Button
                            color="secondary"
                            variant="bordered"
                            onPress={clearWorkspaceForNewBot}
                            isDisabled={!session || !isMasterUser}
                          >
                            clear workspace
                          </Button>
                          <Button
                            color="secondary"
                            variant="ghost"
                            isDisabled={!session || !state.activeBotId}
                            onPress={() => state.activeBotId && loadBotConfig(state.activeBotId)}
                          >
                            reload active bot
                          </Button>
                        </div>
                      </div>
                    )}
                    {showBotControls && <div className="h-px bg-white/10" />}
                    {state.bots.length === 0 ? (
                      <p>no bots yet. create your first project bot.</p>
                    ) : (
                      state.bots.map((bot) => {
                        const isActive = bot.id === state.activeBotId;
                        return (
                          <div
                            key={bot.id}
                            className={`rounded-lg border p-3 ${
                              isActive
                                ? "border-emerald-400/60 bg-emerald-500/10"
                                : "border-white/10 bg-black/20"
                            }`}
                          >
                            <p>
                              <strong>{bot.name}</strong> {isActive ? "(active)" : ""}
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              {bot.productName || "no project name"} | {bot.productType || "type not set"}
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              audience: {bot.audience || "not set"}
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              credential mode: {bot.actionCredentialMode || "owner"}
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              plan day: {bot.day || 1} | posted: {(bot.posted ?? []).length}/14
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              tone: {bot.toneProfile || "not set"}
                            </p>
                            <p className="text-xs text-[var(--text-dim)]">
                              personality: {bot.botPersonality || BOT_PERSONALITY}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                color="secondary"
                                variant={isActive ? "solid" : "flat"}
                                onPress={() => loadBotConfig(bot.id)}
                              >
                                select
                              </Button>
                              <Button
                                size="sm"
                                color="secondary"
                                variant="flat"
                                onPress={() =>
                                  setOpenBotVoiceId((prev) => (prev === bot.id ? null : bot.id))
                                }
                              >
                                open
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                onPress={() => removeBotConfig(bot.id)}
                                isDisabled={!isMasterUser}
                              >
                                delete
                              </Button>
                            </div>
                            {openBotVoiceId === bot.id && (
                              <div className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-black/30 p-3">
                                <Input
                                  size="sm"
                                  label="youtube url (tone source)"
                                  value={bot.youtubeUrl || ""}
                                  onValueChange={(v) => updateBotVoice(bot.id, { youtubeUrl: v })}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    color="secondary"
                                    variant="flat"
                                    onPress={() => analyzeToneForBot(bot.id)}
                                    isLoading={toneAnalyzingBotId === bot.id}
                                    isDisabled={!bot.youtubeUrl?.trim()}
                                  >
                                    {toneAnalyzingBotId === bot.id ? "analyzing..." : "extract tone"}
                                  </Button>
                                  <p className="text-xs text-[var(--text-dim)]">
                                    {toneMsg || "extract tone from youtube or set it manually."}
                                  </p>
                                </div>
                                <Input
                                  size="sm"
                                  label="tone (manual)"
                                  value={bot.toneProfile || ""}
                                  onValueChange={(v) => updateBotVoice(bot.id, { toneProfile: v })}
                                />
                                <Textarea
                                  size="sm"
                                  label="personality"
                                  minRows={2}
                                  value={bot.botPersonality || BOT_PERSONALITY}
                                  onValueChange={(v) => updateBotVoice(bot.id, { botPersonality: v })}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardBody>
                </Card>
                <Card className="cyber-card lg:col-span-2" shadow="none">
                  <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">
                    discord approvals
                  </CardHeader>
                  <CardBody className="gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="discord bot token"
                        type="password"
                        description="use bot token from discord app > bot tab (not app id or public key)"
                        value={state.discordBotToken}
                        onValueChange={(v) => updateBotScoped({ discordBotToken: v })}
                      />
                      <Input
                        label="discord invite url"
                        value={state.discordInviteUrl}
                        onValueChange={(v) => updateBotScoped({ discordInviteUrl: v })}
                      />
                      <Input
                        label="channel name"
                        description="supports text channels and forum channels"
                        value={state.discordChannelName}
                        onValueChange={(v) => updateBotScoped({ discordChannelName: v })}
                      />
                      <Input
                        label="channel id (auto-filled after scan)"
                        value={state.discordChannelId}
                        onValueChange={(v) => updateBotScoped({ discordChannelId: v })}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button color="secondary" onPress={syncDiscordApprovals} isLoading={discordSyncing}>
                        {discordSyncing ? "scanning..." : "scan discord"}
                      </Button>
                      <Button color="primary" variant="flat" onPress={generateDiscordReplies} isLoading={discordGenerating}>
                        {discordGenerating ? "generating..." : "generate replies"}
                      </Button>
                    </div>
                    <Table
                      removeWrapper
                      aria-label="discord workflow buckets"
                      classNames={{ th: "bg-black/20 text-[var(--text-dim)]", td: "text-[var(--text-primary)]/85" }}
                    >
                      <TableHeader>
                        <TableColumn>bucket</TableColumn>
                        <TableColumn>when it lands here</TableColumn>
                        <TableColumn>count</TableColumn>
                      </TableHeader>
                      <TableBody>
                        <TableRow key="new">
                          <TableCell>new posts</TableCell>
                          <TableCell>we have not replied yet</TableCell>
                          <TableCell>{newPostsCount}</TableCell>
                        </TableRow>
                        <TableRow key="waiting">
                          <TableCell>waiting</TableCell>
                          <TableCell>we replied and our reply is last</TableCell>
                          <TableCell>{waitingCount}</TableCell>
                        </TableRow>
                        <TableRow key="followup">
                          <TableCell>needs follow-up</TableCell>
                          <TableCell>we replied, then someone replied again</TableCell>
                          <TableCell>{followUpCount}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    {discordMsg && <p className="text-xs text-[var(--text-dim)]">{discordMsg}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={discordViewTab === "needs_reply" ? "solid" : "flat"}
                        color="secondary"
                        onPress={() => setDiscordViewTab("needs_reply")}
                      >
                        needs reply
                      </Button>
                      <Button
                        size="sm"
                        variant={discordViewTab === "active" ? "solid" : "flat"}
                        color="secondary"
                        onPress={() => setDiscordViewTab("active")}
                      >
                        waiting
                      </Button>
                    </div>
                    {discordViewTab === "needs_reply" ? (
                      state.discordPendingDrafts.length === 0 ? (
                        <p className="text-sm text-[var(--text-dim)]">
                          no posts need reply right now. run scan to refresh from #{state.discordChannelName || "i-shipped"}.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {state.discordPendingDrafts.map((draft) => (
                            <Card key={draft.draftId} className="border border-white/10 bg-black/20" shadow="none">
                              <CardBody className="gap-2">
                                <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                  title: {draft.sourceTitle || "untitled thread"}
                                </p>
                              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                author: @{draft.sourceAuthor}
                              </p>
                              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
                                {(draft.threadMessages && draft.threadMessages.length > 0
                                  ? draft.threadMessages.map((msg) => ({
                                      id: msg.id,
                                      author: msg.author,
                                      text: msg.text,
                                      mine:
                                        msg.author.toLowerCase() === "mymic" ||
                                        msg.author.toLowerCase() === (activeBot?.name ?? "").toLowerCase(),
                                    }))
                                  : parseDiscordThreadMessages(draft.sourceText, draft.sourceAuthor, [
                                      "mymic",
                                      activeBot?.name ?? "",
                                    ])
                                ).map((message, idx) => (
                                  <div
                                    key={message.id}
                                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                                  >
                                    <div
                                      className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                                        message.mine
                                          ? "bg-[color:color-mix(in_srgb,var(--glow-purple)_24%,transparent)] text-[var(--text-primary)]"
                                          : "bg-white/8 text-[var(--text-primary)]/90"
                                      }`}
                                    >
                                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                        #{idx + 1} @{message.author}
                                      </p>
                                      <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <Textarea
                                label="suggested reply"
                                value={draft.replyText}
                                  onValueChange={(v) => updateDiscordDraftReply(draft.draftId, v)}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    color="secondary"
                                    variant="flat"
                                    onPress={() => refreshDiscordDraftReply(draft, "pending")}
                                    isLoading={discordPostingDraftId === draft.draftId}
                                  >
                                    refresh reply
                                  </Button>
                                  <Button
                                    color="secondary"
                                    onPress={() => approveDiscordDraft(draft.draftId)}
                                    isLoading={discordPostingDraftId === draft.draftId}
                                  >
                                    approve and post
                                  </Button>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      )
                    ) : state.discordActiveThreads.length === 0 ? (
                      <p className="text-sm text-[var(--text-dim)]">
                        no waiting threads yet. once our reply is the latest message, threads show here.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {state.discordActiveThreads.map((draft) => (
                          <Card key={draft.draftId} className="border border-white/10 bg-black/20" shadow="none">
                            <CardBody className="gap-2">
                              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                title: {draft.sourceTitle || "untitled thread"}
                              </p>
                              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                author: @{draft.sourceAuthor}
                              </p>
                              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
                                {(draft.threadMessages && draft.threadMessages.length > 0
                                  ? draft.threadMessages.map((msg) => ({
                                      id: msg.id,
                                      author: msg.author,
                                      text: msg.text,
                                      mine:
                                        msg.author.toLowerCase() === "mymic" ||
                                        msg.author.toLowerCase() === (activeBot?.name ?? "").toLowerCase(),
                                    }))
                                  : parseDiscordThreadMessages(draft.sourceText, draft.sourceAuthor, [
                                      "mymic",
                                      activeBot?.name ?? "",
                                    ])
                                ).map((message, idx) => (
                                  <div
                                    key={message.id}
                                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                                  >
                                    <div
                                      className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                                        message.mine
                                          ? "bg-[color:color-mix(in_srgb,var(--glow-purple)_24%,transparent)] text-[var(--text-primary)]"
                                          : "bg-white/8 text-[var(--text-primary)]/90"
                                      }`}
                                    >
                                      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                                        #{idx + 1} @{message.author}
                                      </p>
                                      <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <Textarea
                                label="reply in thread"
                                value={draft.replyText}
                                onValueChange={(v) => updateActiveDraftReply(draft.draftId, v)}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  color="secondary"
                                  variant="flat"
                                  onPress={() => refreshDiscordDraftReply(draft, "active")}
                                  isLoading={discordPostingDraftId === draft.draftId}
                                >
                                  refresh reply
                                </Button>
                                <Button
                                  color="secondary"
                                  onPress={() => replyToActiveDiscordThread(draft.draftId)}
                                  isLoading={discordPostingDraftId === draft.draftId}
                                >
                                  send reply
                                </Button>
                              </div>
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    )}
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_20%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.12em] text-[var(--text-dim)]">learning stream</p>
                      {state.discordLearningLog.length === 0 ? (
                        <p className="text-[var(--text-dim)]">no approved learning yet.</p>
                      ) : (
                        state.discordLearningLog.slice(0, 12).map((entry) => (
                          <div key={`${entry.sourceMessageId}-${entry.at}`} className="mb-2 border-b border-white/10 pb-2 last:border-none">
                            {entry.notes.map((note, idx) => (
                              <p key={`${entry.sourceMessageId}-note-${idx}`} className="text-[var(--text-primary)]/85">
                                - {note}
                              </p>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          )}
          <Tab key="product" title="Product">
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">
                  conversation artifacts
                </CardHeader>
                <CardBody className="gap-3">
                  <p className="text-xs text-[var(--text-dim)]">
                    each discord thread becomes an artifact with product context that keeps updating as replies happen.
                  </p>
                  <Table
                    removeWrapper
                    aria-label="conversation artifacts table"
                    classNames={{ th: "bg-black/20 text-[var(--text-dim)]", td: "text-[var(--text-primary)]/85" }}
                  >
                    <TableHeader>
                      <TableColumn>thread</TableColumn>
                      <TableColumn>status</TableColumn>
                      <TableColumn>product</TableColumn>
                      <TableColumn>audience</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="no artifacts yet. run scan discord in power user tab.">
                      {state.conversationArtifacts.slice(0, 30).map((artifact) => (
                        <TableRow
                          key={artifact.id}
                          className={`cursor-pointer ${selectedArtifact?.id === artifact.id ? "bg-white/5" : ""}`}
                          onClick={() => setSelectedArtifactId(artifact.id)}
                        >
                          <TableCell>{artifact.sourceTitle || "untitled thread"}</TableCell>
                          <TableCell>{artifact.status === "active" ? "waiting" : artifact.status}</TableCell>
                          <TableCell>{artifact.productName || "unknown"}</TableCell>
                          <TableCell>{artifact.audience || "unknown"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">
                  selected artifact
                </CardHeader>
                <CardBody>
                  {selectedArtifact ? (
                    <>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Chip color="secondary" variant="flat">
                          {selectedArtifact.status === "active" ? "waiting" : selectedArtifact.status}
                        </Chip>
                        <Chip color="primary" variant="flat">
                          @{selectedArtifact.sourceAuthor}
                        </Chip>
                      </div>
                      <Input
                        label="product name"
                        value={selectedArtifact.productName}
                        onValueChange={(v) =>
                          updateConversationArtifact(selectedArtifact.id, { productName: v })
                        }
                      />
                      <Input
                        className="mt-3"
                        label="product type"
                        value={selectedArtifact.productType}
                        onValueChange={(v) =>
                          updateConversationArtifact(selectedArtifact.id, { productType: v })
                        }
                      />
                      <Input
                        className="mt-3"
                        label="audience"
                        value={selectedArtifact.audience}
                        onValueChange={(v) =>
                          updateConversationArtifact(selectedArtifact.id, { audience: v })
                        }
                      />
                      <Input
                        className="mt-3"
                        label="intent"
                        value={selectedArtifact.intent}
                        onValueChange={(v) =>
                          updateConversationArtifact(selectedArtifact.id, { intent: v })
                        }
                      />
                      <Textarea
                        className="mt-3"
                        label="context summary"
                        value={selectedArtifact.contextSummary}
                        onValueChange={(v) =>
                          updateConversationArtifact(selectedArtifact.id, { contextSummary: v })
                        }
                      />
                      <p className="mt-2 text-xs text-[var(--text-dim)]">
                        last message: {selectedArtifact.lastMessage || "none"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-dim)]">
                        context checkpoint: {selectedArtifact.contextCapturedMessageCount} message(s), until{" "}
                        {selectedArtifact.contextCapturedUntilMessageId || "not captured yet"}
                      </p>
                      <p className="mt-3 text-xs text-[var(--text-dim)]">
                        campaign controls live in the Actions tab.
                      </p>
                    </>
                  ) : (
                    <p>scan discord first to create artifacts.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>

          <Tab key="connections" title="Connections">
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">owner credentials</CardHeader>
                <CardBody className="gap-3">
                    <Input
                      label="openai api key"
                      type="password"
                      value={state.openaiApiKey}
                      onValueChange={(v) => update({ openaiApiKey: v })}
                      description="used for tone analysis, discord replies, campaign plans, and images"
                    />
                  <Input label="owner x oauth2 token (optional)" type="password" value={state.ownerXToken} onValueChange={(v) => update({ ownerXToken: v })} />
                  <Input label="owner x api key" value={state.ownerXApiKey} onValueChange={(v) => update({ ownerXApiKey: v })} />
                  <Input label="owner x api secret" type="password" value={state.ownerXApiSecret} onValueChange={(v) => update({ ownerXApiSecret: v })} />
                  <Input label="owner x access token" value={state.ownerXAccessToken} onValueChange={(v) => update({ ownerXAccessToken: v })} />
                  <Input label="owner x access token secret" type="password" value={state.ownerXAccessTokenSecret} onValueChange={(v) => update({ ownerXAccessTokenSecret: v })} />
                  <Button color="secondary" variant="flat" onPress={() => setXHelpOpen(true)}>
                    help: where to find x api keys
                  </Button>
                  <p className={hasOwnerX ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>
                    {hasOwnerX ? "owner x connected" : "owner x not connected"}
                  </p>
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">product credentials</CardHeader>
                <CardBody className="gap-3">
                  {!selectedArtifact ? (
                    <p className="text-sm text-[var(--text-dim)]">
                      select a conversation product first.
                    </p>
                  ) : (
                    <>
                      <Input label="product x oauth2 token (optional)" type="password" value={selectedArtifact.xToken} onValueChange={(v) => updateConversationArtifact(selectedArtifact.id, { xToken: v })} />
                      <Input label="product x api key" value={selectedArtifact.xApiKey} onValueChange={(v) => updateConversationArtifact(selectedArtifact.id, { xApiKey: v })} />
                      <Input label="product x api secret" type="password" value={selectedArtifact.xApiSecret} onValueChange={(v) => updateConversationArtifact(selectedArtifact.id, { xApiSecret: v })} />
                      <Input label="product x access token" value={selectedArtifact.xAccessToken} onValueChange={(v) => updateConversationArtifact(selectedArtifact.id, { xAccessToken: v })} />
                      <Input label="product x access token secret" type="password" value={selectedArtifact.xAccessTokenSecret} onValueChange={(v) => updateConversationArtifact(selectedArtifact.id, { xAccessTokenSecret: v })} />
                    </>
                  )}
                  <p className={hasProductX ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>
                    {hasProductX ? "product x connected" : "product x not connected"}
                  </p>
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">active bot context</CardHeader>
                <CardBody className="gap-3">
                  <p className="text-xs text-[var(--text-dim)]">
                    manage creation + deletion in the power user tab. this section shows which bot
                    owns these credentials.
                  </p>
                  <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                    <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">active bot</p>
                    {activeBot ? (
                      <>
                        <p className="mb-1">
                          <strong>{activeBot.name}</strong>
                        </p>
                        <p className="mb-1 text-[var(--text-dim)]">
                          {activeBot.productName || "no project name"} | {activeBot.productType || "type not set"}
                        </p>
                        <p className="text-[var(--text-dim)]">
                          audience: {activeBot.audience || "not set"}
                        </p>
                      </>
                    ) : (
                      <p>no active bot selected. open one from power user.</p>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>

          <Tab key="actions" title="Actions">
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">run campaign</CardHeader>
                <CardBody className="gap-3">
                  <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                    <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">campaign controls</p>
                    <p className="text-[var(--text-dim)]">
                      active conversation: {selectedArtifact?.sourceTitle || selectedArtifact?.productName || "none selected"}
                    </p>
                    <div className="mt-2 grid gap-2">
                      <Textarea
                        size="sm"
                        label="campaign tone"
                        value={state.campaignTone}
                        onValueChange={(v) => updateBotScoped({ campaignTone: v })}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          size="sm"
                          type="number"
                          label="total images to generate (0-14)"
                          value={String(state.campaignImageCount)}
                          onValueChange={(v) => {
                            const next = Number(v);
                            updateBotScoped({
                              campaignImageCount: Number.isFinite(next)
                                ? Math.max(0, Math.min(14, next))
                                : 0,
                            });
                          }}
                        />
                        <Select
                          size="sm"
                          label="image model"
                          selectedKeys={new Set([state.campaignImageModel])}
                          onSelectionChange={(keys) => {
                            const [value] = Array.from(keys);
                            if (value) updateBotScoped({ campaignImageModel: String(value) });
                          }}
                        >
                          {IMAGE_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option.key}>{option.label}</SelectItem>
                          ))}
                        </Select>
                        <Select
                          size="sm"
                          label="image size"
                          selectedKeys={new Set([state.campaignImageSize])}
                          onSelectionChange={(keys) => {
                            const [value] = Array.from(keys);
                            if (value) updateBotScoped({ campaignImageSize: String(value) });
                          }}
                        >
                          {IMAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option.key}>{option.label}</SelectItem>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        color="secondary"
                        onPress={generate}
                        isDisabled={!canGenerate || campaignGenerating}
                      >
                        {campaignGenerating ? "generating..." : "generate plan + images"}
                      </Button>
                      <Button
                        size="sm"
                        color="secondary"
                        variant="flat"
                        onPress={refinePlan}
                        isDisabled={!selectedArtifact?.plan.length || planRefining || !state.openaiApiKey.trim()}
                      >
                        {planRefining ? "updating..." : "update plan"}
                      </Button>
                    </div>
                    {!state.openaiApiKey.trim() && (
                      <p className="mt-2 text-[var(--text-dim)]">
                        add your openai api key in Connections to generate plans and images.
                      </p>
                    )}
                    {imageSuggestions.length > 0 && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">
                          image suggestions
                        </p>
                        {imageSuggestions.map((item) => (
                          <p key={`img-suggest-${item.day}`} className="mb-1 text-[var(--text-dim)]">
                            day {item.day}: {item.reason} — {cleanPostText(item.post).slice(0, 90)}...
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_18%,transparent)] bg-black/20 p-3 text-xs">
                    <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">usage estimate</p>
                    <p className="text-[var(--text-dim)]">
                      estimate for next plan + images run.
                    </p>
                    <p className="text-[var(--text-dim)]">
                      tokens est: {estimatedInputTokens} in / {estimatedOutputTokens} out · images: {imageCount}
                    </p>
                    <p className="text-[var(--text-dim)]">
                      est cost: $
                      {estimatedTotalCost.toFixed(4)} (input ${estimatedInputCost.toFixed(4)} + output $
                      {estimatedOutputCost.toFixed(4)} + images ${estimatedImageCost.toFixed(4)})
                    </p>
                    <p className="text-[var(--text-dim)]">
                      pricing based on gpt-4.1-mini and gpt-image-1 (medium, {state.campaignImageSize}).
                    </p>
                  </div>
                  <Table
                    removeWrapper
                    aria-label="product action status"
                    classNames={{ th: "bg-black/20 text-[var(--text-dim)]", td: "text-[var(--text-primary)]/85" }}
                  >
                    <TableHeader>
                      <TableColumn>conversation</TableColumn>
                      <TableColumn>mode</TableColumn>
                      <TableColumn>x</TableColumn>
                      <TableColumn>plan</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="no products yet. create one in power user.">
                      {state.conversationArtifacts.map((artifact) => {
                        const productXReady = hasXConnection({
                          xToken: artifact.xToken,
                          xApiKey: artifact.xApiKey,
                          xApiSecret: artifact.xApiSecret,
                          xAccessToken: artifact.xAccessToken,
                          xAccessTokenSecret: artifact.xAccessTokenSecret,
                        });
                        return (
                          <TableRow
                            key={`action-artifact-${artifact.id}`}
                            className={`cursor-pointer ${selectedArtifact?.id === artifact.id ? "bg-white/5" : ""}`}
                            onClick={() => setSelectedArtifactId(artifact.id)}
                          >
                            <TableCell>{artifact.sourceTitle || artifact.productName || "untitled"}</TableCell>
                            <TableCell>{artifact.actionCredentialMode || "owner"}</TableCell>
                            <TableCell>{productXReady ? "ready" : "missing"}</TableCell>
                            <TableCell>
                              day {artifact.day ?? 1} | posted {(artifact.posted ?? []).length}/14
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Switch isSelected={state.autoPost} onValueChange={(v) => update({ autoPost: v })}>auto-post planning</Switch>
                  <Switch isSelected={state.autoComment} onValueChange={(v) => update({ autoComment: v })}>auto-comment ideas</Switch>
                  <Switch isSelected={state.autoMetrics} onValueChange={(v) => update({ autoMetrics: v })}>auto-metrics</Switch>
                  <Switch isSelected={showFullPosts} onValueChange={setShowFullPosts}>show full posts</Switch>
                  <div className="flex gap-2">
                    <Button color="secondary" variant="flat" onPress={() => today && navigator.clipboard.writeText(todayCleanPost)} isDisabled={!today}>copy draft</Button>
                    <Button color="secondary" variant="bordered" onPress={() => today && window.open(toComposeUrl(todayCleanPost), "_blank", "noopener,noreferrer")} isDisabled={!today}>open x composer</Button>
                    <Button color="secondary" variant="ghost" onPress={markPosted} isDisabled={!today}>mark posted</Button>
                  </div>
                  <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                    <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">credential mode</p>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        color="secondary"
                        variant={activeCredentialMode === "owner" ? "solid" : "flat"}
                        onPress={() =>
                          selectedArtifact &&
                          updateConversationArtifact(selectedArtifact.id, { actionCredentialMode: "owner" })
                        }
                        isDisabled={!selectedArtifact}
                      >
                        owner mode
                      </Button>
                      <Button
                        size="sm"
                        color="secondary"
                        variant={activeCredentialMode === "product" ? "solid" : "flat"}
                        onPress={() =>
                          selectedArtifact &&
                          updateConversationArtifact(selectedArtifact.id, { actionCredentialMode: "product" })
                        }
                        isDisabled={!selectedArtifact}
                      >
                        product mode
                      </Button>
                    </div>
                    <p className={hasActionX ? "text-emerald-300" : "text-rose-300"}>
                      {activeCredentialMode === "owner"
                        ? hasActionX
                          ? "owner credentials active"
                          : "owner credentials missing"
                        : hasActionX
                          ? "product credentials active"
                          : "product credentials missing"}
                    </p>
                  </div>
                  <Button color="secondary" onPress={publish} isDisabled={!hasActionX || !today || publishing}>
                    {publishing ? "publishing..." : "publish today on x"}
                  </Button>
                  <Button color="secondary" onPress={runDay} isDisabled={!selectedArtifact?.plan.length}>run autopilot day</Button>
                  <Button color="secondary" onPress={executeTodayAutomation} isDisabled={!selectedArtifact?.plan.length || !hasActionX || publishing || engaging || automationRunning}>
                    {automationRunning ? "running automation..." : "execute today (post + comments + metrics)"}
                  </Button>
                  <Button color="secondary" variant="flat" onPress={discoverRelevantPosts} isDisabled={!hasActionX || !searchQuery || discovering}>
                    {discovering ? "discovering..." : "find relevant x posts"}
                  </Button>
                  <Button color="secondary" variant="flat" onPress={autoCommentTopPosts} isDisabled={!hasActionX || !searchQuery || engaging}>
                    {engaging ? "commenting..." : "auto-comment top posts"}
                  </Button>
                  {discoverMsg && <p className="text-xs text-[var(--text-dim)]">{discoverMsg}</p>}
                  {engageMsg && <p className="text-xs text-[var(--text-dim)]">{engageMsg}</p>}
                  <Button color="secondary" variant="flat" onPress={refreshRealMetrics} isDisabled={!hasActionX || metricsLoading}>
                    {metricsLoading ? "syncing metrics..." : "refresh real metrics"}
                  </Button>
                  {metricsMsg && <p className="text-xs text-[var(--text-dim)]">{metricsMsg}</p>}
                  {automationMsg && <p className="text-xs text-[var(--text-dim)]">{automationMsg}</p>}
                  {today?.images?.length ? (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">today images</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {today.images.map((url, idx) => (
                          <Image
                            key={`today-img-${idx}`}
                            src={url}
                            alt={`day ${today.day} image ${idx + 1}`}
                            className="h-32 w-full rounded-md object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {automationLog.length > 0 && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">automation run log</p>
                      {automationLog.slice(-6).map((line, idx) => (
                        <p key={`auto-log-${idx}`} className="mb-1">{line}</p>
                      ))}
                    </div>
                  )}
                  {discoveredPosts.length > 0 && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">top relevant posts</p>
                      {discoveredPosts.slice(0, 3).map((post) => (
                        <p key={post.id} className="mb-2">
                          @{post.authorUsername}: {post.text.slice(0, 120)}...
                        </p>
                      ))}
                    </div>
                  )}
                  {results.map((r) => (
                    <p key={`${r.platform}-${r.message}`} className={r.ok ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>
                      {r.platform}: {r.message}
                    </p>
                  ))}
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-instrument-serif)] uppercase">progress</CardHeader>
                <CardBody className="gap-3">
                  <p>plan: $10 / 14 days</p>
                  <p>mode: build traction first, then package bots for sale</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    campaign id: {state.campaignId || "none"}
                  </p>
                  <p className={hasActionX ? "text-emerald-300" : "text-[var(--text-dim)]"}>
                    {hasActionX
                      ? `${activeCredentialMode} x connected`
                      : `${activeCredentialMode} x not connected`}
                  </p>
                  <Progress value={progress} color="secondary" />
                  <p>
                    views: {selectedArtifact?.views ?? 0} | replies: {selectedArtifact?.replies ?? 0} | followers:{" "}
                    {selectedArtifact?.followers ?? 0}
                  </p>
                  <p>posted days: {postedCount}/14</p>
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="uppercase tracking-[0.18em] text-[var(--text-dim)]">current campaign posts</p>
                        <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          color="secondary"
                          variant={campaignView === "overview" ? "solid" : "flat"}
                          onPress={() => setCampaignView("overview")}
                        >
                          overview
                        </Button>
                        <Button
                          size="sm"
                          color="secondary"
                          variant={campaignView === "day" ? "solid" : "flat"}
                          onPress={() => setCampaignView("day")}
                        >
                          day by day
                        </Button>
                        </div>
                      </div>
                      {archiveView && (
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <Chip size="sm" color="secondary" variant="flat">
                            viewing archive · {new Date(archiveView.createdAt).toLocaleDateString()}
                          </Chip>
                          <Button
                            size="sm"
                            color="secondary"
                            variant="flat"
                            onPress={() => setCampaignArchiveViewId(null)}
                          >
                            back to current
                          </Button>
                        </div>
                      )}
                      {campaignPlan.length === 0 ? (
                        <p>no campaign generated yet.</p>
                      ) : campaignView === "overview" ? (
                        campaignPlan.map((item) => (
                          <p
                            key={`day-${item.day}`}
                            className={campaignPosted.includes(item.day) ? "text-emerald-300 mb-1" : "mb-1"}
                          >
                            day {item.day}: {showFullPosts ? cleanPostText(item.post) : `${cleanPostText(item.post).slice(0, 100)}...`}
                          </p>
                        ))
                      ) : (
                        <div className="space-y-3">
                          <Pagination
                            size="sm"
                            total={campaignPlan.length}
                            page={campaignDayFocus}
                            onChange={(page) => setCampaignDayFocus(page)}
                          />
                        {dayViewItem ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                            <div className="flex gap-3">
                              <Avatar
                                size="sm"
                                name={displayName}
                                classNames={{ base: "bg-white/10", name: "text-xs" }}
                              />
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{displayName}</p>
                                  <p className="text-xs text-[var(--text-dim)]">@{handle} · day {dayViewItem.day}</p>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-[var(--text-primary)]/90">
                                  {cleanPostText(dayViewItem.post)}
                                </p>
                                <Textarea
                                  className="mt-3"
                                  label="image prompt (optional)"
                                  placeholder="describe the specific visual you want for this post"
                                  value={dayViewItem.imagePromptOverride ?? ""}
                                  onValueChange={(value) => updateDayImagePrompt(dayViewItem.day, value)}
                                />
                                {(dayViewItem.images?.length ?? 0) > 0 && (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {dayViewItem.images?.map((url, idx) => (
                                      <Image
                                        key={`day-img-${dayViewItem.day}-${idx}`}
                                        src={url}
                                        alt={`day ${dayViewItem.day} image ${idx + 1}`}
                                        className="h-40 w-full rounded-md object-cover"
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    color="secondary"
                                    variant="flat"
                                    onPress={() => generateImageForDay(dayViewItem.day)}
                                    isDisabled={imageGenerating}
                                  >
                                    {imageGenerating ? "generating image..." : "generate image for this day"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    color={dayViewIsPosted ? "default" : "secondary"}
                                    variant={dayViewIsPosted ? "flat" : "solid"}
                                    onPress={() => publishDay(dayViewItem.day)}
                                    isDisabled={!hasActionX || publishing || dayViewIsPosted}
                                  >
                                    {dayViewIsPosted
                                      ? "published"
                                      : publishing
                                        ? "publishing..."
                                        : "publish this day"}
                                  </Button>
                                </div>
                                <Divider className="my-3 bg-white/10" />
                                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-dim)]">
                                  <span>replies {selectedArtifact?.replies ?? 0}</span>
                                  <span>views {selectedArtifact?.views ?? 0}</span>
                                  <span>followers {selectedArtifact?.followers ?? 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p>no day selected yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                  {(selectedArtifact?.campaignArchive?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_18%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">previous campaigns</p>
                      {(selectedArtifact?.campaignArchive ?? []).slice(0, 4).map((c, idx) => (
                        <div key={`archive-${c.id}-${c.createdAt}-${idx}`} className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p>
                            {new Date(c.createdAt).toLocaleDateString()} | {c.productName || "campaign"} | posted{" "}
                            {c.posted.length}/14
                          </p>
                          <Button
                            size="sm"
                            color="secondary"
                            variant="flat"
                            onPress={() => setCampaignArchiveViewId(c.id)}
                          >
                            view
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>
      </div>
      </div>
      <Modal isOpen={accountOpen} onOpenChange={setAccountOpen} backdrop="blur" placement="center">
        <ModalContent className="cyber-card">
          {() => (
            <>
              <ModalHeader className="font-[family-name:var(--font-instrument-serif)] uppercase">
                account
              </ModalHeader>
              <ModalBody className="gap-3 font-[family-name:var(--font-manrope)] text-sm">
                {!session ? (
                  <>
                    <div className="flex gap-2">
                      <Button
                        color="secondary"
                        variant={authMode === "signin" ? "solid" : "bordered"}
                        onPress={() => setAuthMode("signin")}
                      >
                        sign in
                      </Button>
                      <Button
                        color="secondary"
                        variant={authMode === "signup" ? "solid" : "bordered"}
                        onPress={() => setAuthMode("signup")}
                      >
                        create account
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {authMode === "signup" && (
                        <Input
                          label="name"
                          name="name"
                          autoComplete="name"
                          value={authName}
                          onValueChange={setAuthName}
                        />
                      )}
                      <Input
                        label="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        spellCheck="false"
                        value={authEmail}
                        onValueChange={setAuthEmail}
                      />
                      <Input
                        label="password"
                        name="password"
                        type="password"
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        value={authPassword}
                        onValueChange={setAuthPassword}
                      />
                    </div>
                    {authMode === "signin" ? (
                      <Button color="secondary" onPress={signIn}>
                        sign in
                      </Button>
                    ) : (
                      <Button color="secondary" onPress={signUp}>
                        create account
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_20%,transparent)] bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">account</p>
                      <p className="mt-1 break-all text-[var(--text-primary)]">{session.user.email}</p>
                      <p className="mt-1 text-xs text-[var(--text-dim)]">bots saved: {state.bots.length}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="bordered" color="secondary" onPress={signOut}>
                        sign out
                      </Button>
                    </div>
                  </>
                )}
                {authMsg && <p className="text-xs text-[var(--text-dim)]">{authMsg}</p>}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={xHelpOpen} onOpenChange={setXHelpOpen} backdrop="blur" placement="center">
        <ModalContent className="cyber-card">
          {(onClose) => (
            <>
              <ModalHeader className="font-[family-name:var(--font-instrument-serif)] uppercase">
                x (twitter) developer app setup guide
              </ModalHeader>
              <ModalBody className="font-[family-name:var(--font-manrope)] text-sm text-[var(--text-primary)]/90">
                <p>
                  <strong>step 1: create your developer account</strong> <br />
                  go to developer.twitter.com and sign in with your x account. if you do not
                  have a developer account yet, apply for access. basic tier is free and usually
                  approved quickly.
                </p>
                <p>
                  <strong>step 2: create a new project and app</strong> <br />
                  in the developer portal, click create project, give it a name (example: mymic
                  ai), select your use case (making a bot or automated app), then create a new
                  app inside that project.
                </p>
                <p>
                  <strong>step 3: app permissions</strong> <br />
                  open app settings and find app permissions. select <strong>read and write and direct message</strong>.
                  this is required for mymic ai to read conversations, post on your behalf, and
                  send dms. keep request email from users turned off unless you explicitly need it.
                </p>
                <p>
                  <strong>step 4: type of app</strong> <br />
                  choose <strong>web app, automated app or bot</strong> and use a confidential client.
                  this is the correct setup for server-side automation.
                </p>
                <p>
                  <strong>step 5: app info</strong> <br />
                  callback uri/redirect url: use the mymic onboarding callback (for local testing,
                  https://localhost/ works temporarily). website url: your site, github, or any live
                  url. organization name is optional.
                </p>
                <p>
                  <strong>step 6: save and get your keys</strong> <br />
                  go to keys and tokens and generate: api key and secret (consumer keys), access token
                  and secret, and bearer token. save them securely and paste them in the connections tab.
                </p>
                <p className="text-[var(--text-dim)]">
                  note: app-only bearer tokens cannot publish posts. oauth user-context keys are required.
                  urls can be updated after deploy.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="secondary" onPress={onClose}>
                  got it
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </main>
  );
}


