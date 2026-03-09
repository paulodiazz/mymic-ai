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
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Switch,
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
type Day = { day: number; post: string; play: string };
type DiscordDraft = {
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
type LearningItem = {
  at: string;
  sourceMessageId: string;
  notes: string[];
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
  youtubeUrl: string;
  toneProfile: string;
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
  createdAt: string;
};
const BOT_PERSONALITY =
  "i'm a new bot, a little clumsy, but i learn fast when people help me.";
type AppState = {
  started: boolean;
  selectedTab: "account" | "power" | "product" | "connections" | "actions";
  productName: string;
  productType: string;
  audience: string;
  goal: string;
  youtubeUrl: string;
  openaiApiKey: string;
  toneProfile: string;
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
  productName: "",
  productType: "",
  audience: "",
  goal: "",
  youtubeUrl: "",
  openaiApiKey: "",
  toneProfile: "direct creator",
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

function buildPlan(state: AppState): Day[] {
  return Array.from({ length: 14 }, (_, i) => {
    const day = i + 1;
    const tone = state.toneProfile;
    if (day % 3 === 1) {
      return {
        day,
        post: `[tone: ${tone}] ${BOT_PERSONALITY} building ${state.productName} for ${state.audience}. shipped a win today. chasing ${state.goal}. what should improve next?`,
        play: "leave thoughtful comments on 10 builder posts.",
      };
    }
    if (day % 3 === 2) {
      return {
        day,
        post: `[tone: ${tone}] ${BOT_PERSONALITY} lesson from today while building ${state.productName}: speed + feedback beats perfection.`,
        play: "reply to every comment with one follow-up question.",
      };
    }
    return {
      day,
      post: `[tone: ${tone}] ${BOT_PERSONALITY} quick update: ${state.productName} is getting traction with ${state.audience}. opening 3 early spots.`,
      play: "join launch threads and add one concrete opinion.",
    };
  });
}

const toComposeUrl = (text: string): string =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
const cleanPostText = (text: string): string =>
  text.replace(/^\s*\[tone:[^\]]+\]\s*/i, "").trim();
const newCampaignId = (): string =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const newBotId = (): string =>
  `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MASTER_EMAIL = "paulodiazg32@gmail.com";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMsg, setAuthMsg] = useState("");
  const [xHelpOpen, setXHelpOpen] = useState(false);
  const [botNameInput, setBotNameInput] = useState("");

  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);

  const [toneMsg, setToneMsg] = useState("");
  const [toneLoading, setToneLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishRes[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsMsg, setMetricsMsg] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoverPost[]>([]);
  const [discoverMsg, setDiscoverMsg] = useState("");
  const [engaging, setEngaging] = useState(false);
  const [engageMsg, setEngageMsg] = useState("");
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationMsg, setAutomationMsg] = useState("");
  const [automationLog, setAutomationLog] = useState<string[]>([]);
  const [discordSyncing, setDiscordSyncing] = useState(false);
  const [discordMsg, setDiscordMsg] = useState("");
  const [discordPostingDraftId, setDiscordPostingDraftId] = useState<string | null>(null);
  const [discordViewTab, setDiscordViewTab] = useState<"needs_reply" | "active">("needs_reply");
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

      const { data, error } = await supabase
        .from("user_app_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setAuthMsg("could not load your cloud state.");
        setStateLoaded(true);
        return;
      }

      if (data?.state) {
        const merged = { ...DEFAULT_STATE, ...(data.state as Partial<AppState>) };
        if (!merged.campaignId) merged.campaignId = newCampaignId();
        if (!Array.isArray(merged.campaignArchive)) merged.campaignArchive = [];
        setState(merged);
      } else {
        await supabase
          .from("user_app_state")
          .upsert(
            { user_id: userId, state: { ...DEFAULT_STATE, campaignId: newCampaignId() } },
            { onConflict: "user_id" }
          );
        setState({ ...DEFAULT_STATE, campaignId: newCampaignId() });
      }

      setStateLoaded(true);
    }

    loadState();
  }, [userId]);

  useEffect(() => {
    if (!userId || !stateLoaded || !supabase) return;
    const sb = supabase;
    const timer = setTimeout(async () => {
      await sb
        .from("user_app_state")
        .upsert({ user_id: userId, state }, { onConflict: "user_id" });
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, state, stateLoaded]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      setCursor({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const hasX =
    !!state.xToken ||
    (!!state.xApiKey &&
      !!state.xApiSecret &&
      !!state.xAccessToken &&
      !!state.xAccessTokenSecret);
  const today = state.plan[state.day - 1];
  const selectedTab = state.selectedTab;
  const todayCleanPost = today ? cleanPostText(today.post) : "";
  const scheduledDays = state.plan.slice(state.day - 1, state.day + 4);
  const progress = Math.round((state.day / 14) * 100);
  const postedCount = state.posted.length;
  const isMasterUser = (session?.user?.email ?? "").toLowerCase() === MASTER_EMAIL;
  const activeBot = state.bots.find((bot) => bot.id === state.activeBotId) ?? null;
  const canGenerate =
    !!state.productName && !!state.productType && !!state.audience && !!state.goal;

  useEffect(() => {
    if (!isMasterUser && state.selectedTab === "power") {
      setState((prev) =>
        prev.selectedTab === "power" ? { ...prev, selectedTab: "account" } : prev,
      );
      return;
    }
    if (isMasterUser && state.selectedTab === "account") {
      setState((prev) =>
        prev.selectedTab === "account" ? { ...prev, selectedTab: "power" } : prev,
      );
    }
  }, [isMasterUser, state.selectedTab]);

  const update = (patch: Partial<AppState>) => setState((prev) => ({ ...prev, ...patch }));
  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const saveStateNow = async (next: AppState = state) => {
    if (!userId || !supabase) return;
    await supabase
      .from("user_app_state")
      .upsert({ user_id: userId, state: next }, { onConflict: "user_id" });
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
    await saveStateNow();
    await supabase.auth.signOut();
    setAuthMsg("signed out.");
  };

  const clearWorkspaceForNewBot = () => {
    if (!isMasterUser) {
      setAuthMsg("power user access required to create bots.");
      return;
    }
    update({
      activeBotId: null,
      productName: "",
      productType: "",
      audience: "",
      goal: "",
      youtubeUrl: "",
      toneProfile: "direct creator",
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
      youtubeUrl: state.youtubeUrl,
      toneProfile: state.toneProfile,
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
      youtubeUrl: bot.youtubeUrl,
      toneProfile: bot.toneProfile,
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
    });
    setBotNameInput(bot.name);
    setAuthMsg(`loaded bot "${bot.name}".`);
  };

  const removeBotConfig = (botId: string) => {
    if (!isMasterUser) {
      setAuthMsg("power user access required to manage bots.");
      return;
    }
    const bot = state.bots.find((item) => item.id === botId);
    const remaining = state.bots.filter((item) => item.id !== botId);
    update({
      bots: remaining,
      activeBotId:
        state.activeBotId === botId ? (remaining.length > 0 ? remaining[0].id : null) : state.activeBotId,
    });
    setAuthMsg(bot ? `deleted bot "${bot.name}".` : "bot deleted.");
  };

  const analyzeTone = async () => {
    if (!state.youtubeUrl) return;
    setToneLoading(true);
    setToneMsg("analyzing...");
    try {
      const r = await fetch("/api/tone/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: state.youtubeUrl,
          openaiApiKey: state.openaiApiKey,
        }),
      });
      const d = (await r.json()) as ToneRes;
      if (!d.ok || !d.tone) {
        setToneMsg(d.error || "tone analysis failed");
        return;
      }
      update({ toneProfile: `${d.tone.toneName}: ${d.tone.summary}` });
      const source = d.source ?? "unknown";
      const warning = d.warning ? ` ${d.warning}` : "";
      setToneMsg(`tone from ${source} in "${d.title}" (${d.wordCount ?? 0} words).${warning}`);
    } catch {
      setToneMsg("tone analysis failed.");
    } finally {
      setToneLoading(false);
    }
  };

  const generate = () => {
    const archive =
      state.plan.length > 0
        ? [
            {
              id: state.campaignId || newCampaignId(),
              createdAt: new Date().toISOString(),
              productName: state.productName,
              plan: state.plan,
              posted: state.posted,
              postedTweetIds: state.postedTweetIds,
              views: state.views,
              replies: state.replies,
              followers: state.followers,
            },
            ...state.campaignArchive,
          ].slice(0, 20)
        : state.campaignArchive;

    update({
      plan: buildPlan(state),
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
    setAutomationLog([]);
  };

  const runDay = () => {
    if (!state.plan.length) return;
    const d = state.day;
    update({ day: Math.min(14, d + 1) });
  };

  const searchQuery = useMemo(() => {
    const parts = [state.productName, state.productType, state.audience]
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.join(" ");
  }, [state.productName, state.productType, state.audience]);

  const markPosted = () => {
    if (!today || state.posted.includes(state.day)) return;
    update({ posted: [...state.posted, state.day].sort((a, b) => a - b) });
  };

  const publish = async () => {
    if (!today || publishing) return;
    setPublishing(true);
    setResults([]);
    try {
      const r = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: todayCleanPost,
          campaignId: state.campaignId,
          day: state.day,
          platforms: ["x"],
          connections: {
            xToken: state.xToken,
            xApiKey: state.xApiKey,
            xApiSecret: state.xApiSecret,
            xAccessToken: state.xAccessToken,
            xAccessTokenSecret: state.xAccessTokenSecret,
          },
        }),
      });
      const d = (await r.json()) as { results?: PublishRes[] };
      const next = d.results ?? [];
      setResults(next);
      if (next.some((item) => item.ok)) {
        markPosted();
        const ids = next.map((item) => item.postId).filter((id): id is string => Boolean(id));
        const nextPostedIds = ids.length
          ? Array.from(new Set([...state.postedTweetIds, ...ids]))
          : state.postedTweetIds;
        update({
          postedTweetIds: nextPostedIds,
          day: Math.min(14, state.day + 1),
        });
      }
    } catch {
      setResults([{ platform: "x", ok: false, message: "publish failed." }]);
    } finally {
      setPublishing(false);
    }
  };

  const refreshRealMetrics = async () => {
    if (!hasX) {
      setMetricsMsg("connect x credentials first.");
      return;
    }
    setMetricsLoading(true);
    setMetricsMsg("syncing live metrics...");
    try {
      const r = await fetch("/api/social/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetIds: state.postedTweetIds,
          connections: {
            xToken: state.xToken,
            xApiKey: state.xApiKey,
            xApiSecret: state.xApiSecret,
            xAccessToken: state.xAccessToken,
            xAccessTokenSecret: state.xAccessTokenSecret,
          },
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
      update({
        views: d.metrics.views ?? 0,
        replies: d.metrics.replies ?? 0,
        followers: d.metrics.followers ?? 0,
      });
      const warning = d.warning ? ` ${d.warning}` : "";
      setMetricsMsg(`live metrics synced from ${d.account ?? "x account"} (${d.source ?? "x"}).${warning}`);
    } catch {
      setMetricsMsg("metrics sync failed.");
    } finally {
      setMetricsLoading(false);
    }
  };

  const discoverRelevantPosts = async () => {
    if (!hasX || !searchQuery) return;
    setDiscovering(true);
    setDiscoverMsg("finding relevant posts...");
    try {
      const r = await fetch("/api/social/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 10,
          connections: {
            xToken: state.xToken,
            xApiKey: state.xApiKey,
            xApiSecret: state.xApiSecret,
            xAccessToken: state.xAccessToken,
            xAccessTokenSecret: state.xAccessTokenSecret,
          },
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
    if (!hasX || !searchQuery || engaging) return;
    setEngaging(true);
    setEngageMsg("posting replies...");
    try {
      const r = await fetch("/api/social/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          productName: state.productName,
          audience: state.audience,
          openaiApiKey: state.openaiApiKey,
          maxReplies: 2,
          connections: {
            xToken: state.xToken,
            xApiKey: state.xApiKey,
            xApiSecret: state.xApiSecret,
            xAccessToken: state.xAccessToken,
            xAccessTokenSecret: state.xAccessTokenSecret,
          },
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
          openaiApiKey: state.openaiApiKey,
          productName: state.productName || botNameInput || "my project",
          audience: state.audience || "builders",
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

      const incoming = d.drafts ?? [];
      const pending = incoming.filter((item) => (item.status ?? "needs_reply") === "needs_reply");
      const active = incoming.filter((item) => item.status === "active");
      update({
        discordChannelId: d.channelId ?? state.discordChannelId,
        discordChannelName: d.channelName ?? state.discordChannelName,
        discordPendingDrafts: pending.slice(0, 100),
        discordActiveThreads: active.slice(0, 100),
      });
      setDiscordMsg(
        incoming.length > 0
          ? `loaded ${incoming.length} threads. needs reply: ${pending.length}, active: ${active.length}.`
          : `no posts found. scanned ${d.stats?.threadCount ?? 0} thread(s), ${d.stats?.messageCount ?? 0} message(s).`,
      );
    } catch {
      setDiscordMsg("discord scan failed.");
    } finally {
      setDiscordSyncing(false);
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
      update({
        discordPendingDrafts: state.discordPendingDrafts.filter((item) => item.draftId !== draftId),
        discordActiveThreads: [
          { ...draft, status: "active" as const },
          ...state.discordActiveThreads.filter((item) => item.draftId !== draftId),
        ].slice(0, 100),
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
    update({
      discordPendingDrafts: state.discordPendingDrafts.map((draft) =>
        draft.draftId === draftId ? { ...draft, replyText } : draft,
      ),
    });
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
            <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase tracking-[0.26em] text-[var(--text-dim)]">
              mymic ai
            </p>
            <h1 className="mt-4 max-w-5xl font-[family-name:var(--font-orbitron)] text-4xl uppercase leading-tight [text-shadow:0_0_20px_color-mix(in_srgb,var(--glow-pink)_35%,transparent)] sm:text-6xl">
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
                    <p className="font-[family-name:var(--font-orbitron)] text-sm uppercase tracking-[0.18em]">
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
            <h2 className="font-[family-name:var(--font-orbitron)] text-2xl uppercase sm:text-4xl">
              how it works
            </h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {steps.map((step, i) => (
                <Card key={step.title} className="cyber-card cyber-float" shadow="none" style={{ "--delay": `${240 + i * 70}ms` } as CSSProperties}>
                  <CardBody className="gap-2">
                    <p className="font-[family-name:var(--font-orbitron)] text-sm uppercase tracking-[0.15em]">
                      {step.title}
                    </p>
                    <p className="text-sm text-[var(--text-primary)]/85">{step.line}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="cyber-float" style={{ "--delay": "210ms" } as CSSProperties}>
            <h2 className="font-[family-name:var(--font-orbitron)] text-2xl uppercase sm:text-4xl">
              core features
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature} className="cyber-card" shadow="none">
                  <CardBody>
                    <p className="font-[family-name:var(--font-space-mono)] text-sm uppercase tracking-[0.12em] text-[var(--text-primary)]/90">
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
                <p className="mx-auto max-w-4xl font-[family-name:var(--font-orbitron)] text-xl uppercase leading-relaxed sm:text-3xl">
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
            <p className="font-[family-name:var(--font-space-mono)] text-sm uppercase tracking-[0.18em] text-[var(--text-dim)]">
              built for people who ship. trusted by builders who don&apos;t have time to be everywhere.
            </p>
          </section>

          <section className="cyber-float pb-8 text-center" style={{ "--delay": "330ms" } as CSSProperties}>
            <h2 className="font-[family-name:var(--font-orbitron)] text-3xl uppercase [text-shadow:0_0_24px_color-mix(in_srgb,var(--glow-purple)_40%,transparent)] sm:text-5xl">
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
              <p className="font-[family-name:var(--font-orbitron)] uppercase">mymic ai</p>
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
          <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
            menu
          </CardHeader>
          <CardBody className="gap-2">
            <Button className="justify-start" color="secondary" variant="flat" onPress={() => update({ started: false })}>
              Home
            </Button>
            <Button
              className="justify-start"
              color="secondary"
              variant={selectedTab === "account" ? "solid" : "flat"}
              onPress={() => {
                update({ selectedTab: "account" });
                jumpTo("workflow-section");
              }}
            >
              Account
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
              <p className="mt-1 text-[var(--text-primary)]">{hasX ? "ready" : "needs x connection"}</p>
              <p className="text-[var(--text-dim)]">posted {postedCount}/14</p>
            </div>
          </CardBody>
        </Card>
        <div>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase tracking-[0.26em] text-[var(--text-dim)]">
              mymic ai
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl uppercase sm:text-5xl">
              growth console
            </h1>
          </div>
          <Badge
            variant="flat"
            className="border border-[color:color-mix(in_srgb,var(--glow-pink)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_82%,transparent)] px-3 py-2 font-[family-name:var(--font-space-mono)] text-[var(--text-primary)]"
          >
            x live | linkedin/tiktok soon
          </Badge>
        </div>

        <Card className="cyber-card mb-6" shadow="none">
          <CardBody className="gap-2 text-sm">
            <p className="font-[family-name:var(--font-orbitron)] uppercase">quick guide</p>
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
              selectedTab: String(key) as "account" | "power" | "product" | "connections" | "actions",
            })
          }
          classNames={{ tab: "font-[family-name:var(--font-space-mono)] uppercase tracking-wider" }}
        >
          <Tab key="account" title="Account">
            <Card id="account-section" className="cyber-card mt-4" shadow="none">
              <CardHeader className="flex items-center justify-between gap-3 pb-0">
                <div>
                  <p className="font-[family-name:var(--font-orbitron)] uppercase">account</p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    connect your account to save and sync your bot workspace.
                  </p>
                </div>
                <Chip color={session ? "success" : "default"} variant="flat">
                  {session ? "connected" : "not connected"}
                </Chip>
              </CardHeader>
              <CardBody className="gap-3 font-[family-name:var(--font-space-mono)] text-sm">
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
                    <div className="grid gap-3 sm:grid-cols-1">
                      <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_20%,transparent)] bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">account</p>
                        <p className="mt-1 break-all text-[var(--text-primary)]">{session.user.email}</p>
                        <p className="mt-1 text-xs text-[var(--text-dim)]">bots saved: {state.bots.length}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="bordered" color="secondary" onPress={signOut}>
                        sign out
                      </Button>
                    </div>
                  </>
                )}
                {authMsg && <p className="text-xs text-[var(--text-dim)]">{authMsg}</p>}
              </CardBody>
            </Card>
          </Tab>
          {isMasterUser && (
            <Tab key="power" title="Power User">
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <Card className="cyber-card" shadow="none">
                  <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
                    bot controls
                  </CardHeader>
                  <CardBody className="gap-3 text-sm">
                  <Input
                    label="bot name"
                    value={botNameInput}
                    onValueChange={setBotNameInput}
                    isDisabled={!session || !isMasterUser}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
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
                  </CardBody>
                </Card>
                <Card className="cyber-card" shadow="none">
                  <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
                    project bots
                  </CardHeader>
                  <CardBody className="gap-3 text-sm">
                    {state.bots.length === 0 ? (
                      <p>no bots yet. create your first project bot.</p>
                    ) : (
                      state.bots.map((bot) => (
                        <div key={bot.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p>
                            <strong>{bot.name}</strong> {bot.id === state.activeBotId ? "(active)" : ""}
                          </p>
                          <p className="text-xs text-[var(--text-dim)]">
                            {bot.productName || "no project name"} | {bot.productType || "type not set"}
                          </p>
                          <p className="text-xs text-[var(--text-dim)]">
                            audience: {bot.audience || "not set"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" color="secondary" variant="flat" onPress={() => loadBotConfig(bot.id)}>
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
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
                <Card className="cyber-card lg:col-span-2" shadow="none">
                  <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
                    discord approvals
                  </CardHeader>
                  <CardBody className="gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="discord bot token"
                        type="password"
                        description="use bot token from discord app > bot tab (not app id or public key)"
                        value={state.discordBotToken}
                        onValueChange={(v) => update({ discordBotToken: v })}
                      />
                      <Input
                        label="discord invite url"
                        value={state.discordInviteUrl}
                        onValueChange={(v) => update({ discordInviteUrl: v })}
                      />
                      <Input
                        label="channel name"
                        description="supports text channels and forum channels"
                        value={state.discordChannelName}
                        onValueChange={(v) => update({ discordChannelName: v })}
                      />
                      <Input
                        label="channel id (auto-filled after scan)"
                        value={state.discordChannelId}
                        onValueChange={(v) => update({ discordChannelId: v })}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button color="secondary" onPress={syncDiscordApprovals} isLoading={discordSyncing}>
                        {discordSyncing ? "scanning..." : "scan and queue approvals"}
                      </Button>
                      <Chip variant="flat" color="secondary">
                        needs reply: {state.discordPendingDrafts.length}
                      </Chip>
                      <Chip variant="flat" color="primary">
                        active: {state.discordActiveThreads.length}
                      </Chip>
                    </div>
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
                        active conversations
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
                                <p className="text-sm text-[var(--text-primary)]/85">{draft.sourceText}</p>
                                <Textarea
                                  label="suggested reply"
                                  value={draft.replyText}
                                  onValueChange={(v) => updateDiscordDraftReply(draft.draftId, v)}
                                />
                                <div className="flex flex-wrap gap-2">
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
                        no active conversations yet. approve a reply and it will appear here.
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
                              <p className="text-sm text-[var(--text-primary)]/85">{draft.sourceText}</p>
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
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
                  product + tone
                </CardHeader>
                <CardBody className="gap-3">
                  <Input label="product name" value={state.productName} onValueChange={(v) => update({ productName: v })} />
                  <Input label="product type" value={state.productType} onValueChange={(v) => update({ productType: v })} />
                  <Textarea label="audience" value={state.audience} onValueChange={(v) => update({ audience: v })} />
                  <Input label="goal in 14 days" value={state.goal} onValueChange={(v) => update({ goal: v })} />
                  <Input label="youtube url (tone source)" value={state.youtubeUrl} onValueChange={(v) => update({ youtubeUrl: v })} />
                  <Input label="openai api key (tone)" type="password" value={state.openaiApiKey} onValueChange={(v) => update({ openaiApiKey: v })} />
                  <Button color="secondary" variant="flat" onPress={analyzeTone} isDisabled={!state.youtubeUrl}>
                    {toneLoading ? "analyzing..." : "analyze tone"}
                  </Button>
                  <p className="text-xs text-[var(--text-dim)]">{toneMsg || `tone: ${state.toneProfile}`}</p>
                  <Button color="secondary" onPress={generate} isDisabled={!canGenerate}>generate 14-day plan</Button>
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">
                  today output
                </CardHeader>
                <CardBody>
                  {today ? (
                    <>
                      <Chip color="secondary" variant="flat">day {today.day}</Chip>
                      <p className="mt-2 text-sm">{todayCleanPost}</p>
                      <p className="mt-2 text-sm text-[var(--text-dim)]">engagement: {today.play}</p>
                    </>
                  ) : (
                    <p>generate a plan first.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>

          <Tab key="connections" title="Connections">
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">x credentials</CardHeader>
                <CardBody className="gap-3">
                  <Input label="x oauth2 token (optional)" type="password" value={state.xToken} onValueChange={(v) => update({ xToken: v })} />
                  <Input label="x api key" value={state.xApiKey} onValueChange={(v) => update({ xApiKey: v })} />
                  <Input label="x api secret" type="password" value={state.xApiSecret} onValueChange={(v) => update({ xApiSecret: v })} />
                  <Input label="x access token" value={state.xAccessToken} onValueChange={(v) => update({ xAccessToken: v })} />
                  <Input label="x access token secret" type="password" value={state.xAccessTokenSecret} onValueChange={(v) => update({ xAccessTokenSecret: v })} />
                  <Button color="secondary" variant="flat" onPress={() => setXHelpOpen(true)}>
                    help: where to find x api keys
                  </Button>
                  <p className={hasX ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>{hasX ? "x connected" : "x not connected"}</p>
                </CardBody>
              </Card>
              <Card className="cyber-card" shadow="none">
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">active bot context</CardHeader>
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
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">run campaign</CardHeader>
                <CardBody className="gap-3">
                  <Switch isSelected={state.autoPost} onValueChange={(v) => update({ autoPost: v })}>auto-post planning</Switch>
                  <Switch isSelected={state.autoComment} onValueChange={(v) => update({ autoComment: v })}>auto-comment ideas</Switch>
                  <Switch isSelected={state.autoMetrics} onValueChange={(v) => update({ autoMetrics: v })}>auto-metrics</Switch>
                  <div className="flex gap-2">
                    <Button color="secondary" variant="flat" onPress={() => today && navigator.clipboard.writeText(todayCleanPost)} isDisabled={!today}>copy draft</Button>
                    <Button color="secondary" variant="bordered" onPress={() => today && window.open(toComposeUrl(todayCleanPost), "_blank", "noopener,noreferrer")} isDisabled={!today}>open x composer</Button>
                    <Button color="secondary" variant="ghost" onPress={markPosted} isDisabled={!today}>mark posted</Button>
                  </div>
                  <Button color="secondary" onPress={publish} isDisabled={!hasX || !today || publishing}>
                    {publishing ? "publishing..." : "publish today on x"}
                  </Button>
                  <Button color="secondary" onPress={runDay} isDisabled={!state.plan.length}>run autopilot day</Button>
                  <Button color="secondary" onPress={executeTodayAutomation} isDisabled={!state.plan.length || !hasX || publishing || engaging || automationRunning}>
                    {automationRunning ? "running automation..." : "execute today (post + comments + metrics)"}
                  </Button>
                  <Button color="secondary" variant="flat" onPress={discoverRelevantPosts} isDisabled={!hasX || !searchQuery || discovering}>
                    {discovering ? "discovering..." : "find relevant x posts"}
                  </Button>
                  <Button color="secondary" variant="flat" onPress={autoCommentTopPosts} isDisabled={!hasX || !searchQuery || engaging}>
                    {engaging ? "commenting..." : "auto-comment top posts"}
                  </Button>
                  {discoverMsg && <p className="text-xs text-[var(--text-dim)]">{discoverMsg}</p>}
                  {engageMsg && <p className="text-xs text-[var(--text-dim)]">{engageMsg}</p>}
                  <Button color="secondary" variant="flat" onPress={refreshRealMetrics} isDisabled={!hasX || metricsLoading}>
                    {metricsLoading ? "syncing metrics..." : "refresh real metrics"}
                  </Button>
                  {metricsMsg && <p className="text-xs text-[var(--text-dim)]">{metricsMsg}</p>}
                  {automationMsg && <p className="text-xs text-[var(--text-dim)]">{automationMsg}</p>}
                  {scheduledDays.length > 0 && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">scheduled next</p>
                      {scheduledDays.map((item) => (
                        <p key={`scheduled-${item.day}`} className="mb-1">
                          day {item.day}: {cleanPostText(item.post).slice(0, 90)}...
                        </p>
                      ))}
                    </div>
                  )}
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
                <CardHeader className="pb-0 font-[family-name:var(--font-orbitron)] uppercase">progress</CardHeader>
                <CardBody className="gap-3">
                  <p>plan: $10 / 14 days</p>
                  <p>mode: build traction first, then package bots for sale</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    campaign id: {state.campaignId || "none"}
                  </p>
                  <p className={hasX ? "text-emerald-300" : "text-[var(--text-dim)]"}>
                    {hasX ? "x connected" : "x not connected"}
                  </p>
                  <Progress value={progress} color="secondary" />
                  <p>views: {state.views} | replies: {state.replies} | followers: {state.followers}</p>
                  <p>posted days: {postedCount}/14</p>
                  <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_22%,transparent)] bg-black/20 p-3 text-xs">
                    <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">current campaign posts</p>
                    {state.plan.length === 0 ? (
                      <p>no campaign generated yet.</p>
                    ) : (
                      state.plan.map((item) => (
                        <p key={`day-${item.day}`} className={state.posted.includes(item.day) ? "text-emerald-300 mb-1" : "mb-1"}>
                          day {item.day}: {cleanPostText(item.post).slice(0, 100)}...
                        </p>
                      ))
                    )}
                  </div>
                  {state.campaignArchive.length > 0 && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glow-purple)_18%,transparent)] bg-black/20 p-3 text-xs">
                      <p className="mb-2 uppercase tracking-[0.18em] text-[var(--text-dim)]">previous campaigns</p>
                      {state.campaignArchive.slice(0, 4).map((c) => (
                        <p key={c.id} className="mb-1">
                          {new Date(c.createdAt).toLocaleDateString()} | {c.productName || "campaign"} | posted {c.posted.length}/14
                        </p>
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
      <Modal isOpen={xHelpOpen} onOpenChange={setXHelpOpen} backdrop="blur" placement="center">
        <ModalContent className="cyber-card">
          {(onClose) => (
            <>
              <ModalHeader className="font-[family-name:var(--font-orbitron)] uppercase">
                x (twitter) developer app setup guide
              </ModalHeader>
              <ModalBody className="font-[family-name:var(--font-space-mono)] text-sm text-[var(--text-primary)]/90">
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

