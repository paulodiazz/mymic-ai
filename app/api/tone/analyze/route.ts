import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

type ToneResult = {
  toneName: string;
  summary: string;
  styleGuide: string[];
  sampleOpeners: string[];
  toneBlend?: string[];
  dimensions?: Record<string, number>;
  rationale?: string;
};

async function analyzeToneWithGpt(
  text: string,
  apiKey: string
): Promise<ToneResult | null> {
  if (!apiKey) return null;

  const prompt = `
analyze the communication tone of this creator transcript/content.
return strict json with this shape:
{
  "toneName": "primary short label",
  "summary": "one-sentence summary",
  "styleGuide": ["3 concise style rules"],
  "sampleOpeners": ["2 opener examples"],
  "toneBlend": ["4-6 tone tags"],
  "dimensions": {
    "contrarian": 0-100,
    "educational": 0-100,
    "storytelling": 0-100,
    "emotional_intensity": 0-100,
    "analytical": 0-100,
    "humor": 0-100,
    "authority": 0-100
  },
  "rationale": "very short explanation"
}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "you are an expert communication style analyst." },
        { role: "user", content: `${prompt}\n\ncontent:\n${text.slice(0, 12000)}` },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as ToneResult;
    if (!parsed.toneName || !parsed.summary) return null;
    return parsed;
  } catch {
    return null;
  }
}

function inferToneFromMetadata(title: string, author: string): ToneResult {
  const text = `${title} ${author}`.toLowerCase();

  if (/(how to|tutorial|guide|lesson|tips|framework|strategy)/.test(text)) {
    return {
      toneName: "educational operator",
      summary: "clear, tactical, and practical with concrete takeaways.",
      styleGuide: [
        "lead with one practical promise",
        "use short direct sentences",
        "close with one action people can do today",
      ],
      sampleOpeners: [
        "if you are shipping this week, start here:",
        "one tactic that moved our numbers today:",
      ],
    };
  }

  if (/(podcast|interview|conversation|debate|talk)/.test(text)) {
    return {
      toneName: "conversational authority",
      summary: "opinionated, social-first, and discussion-driven.",
      styleGuide: [
        "open with a strong claim",
        "invite disagreement without being defensive",
        "back takes with real examples",
      ],
      sampleOpeners: [
        "hot take for builders shipping in public:",
        "most people get this wrong when launching:",
      ],
    };
  }

  if (/(journey|story|vlog|day in|build in public|my first)/.test(text)) {
    return {
      toneName: "story-driven builder",
      summary: "personal, transparent, and momentum-focused.",
      styleGuide: [
        "start with a real moment from today",
        "show what changed since last update",
        "ask for one specific piece of feedback",
      ],
      sampleOpeners: [
        "today was messy, but here is what finally worked:",
        "day update: one win and one mistake:",
      ],
    };
  }

  return {
    toneName: "direct creator",
    summary: "concise, confident, and high-signal.",
    styleGuide: [
      "one idea per post",
      "tight sentences and concrete language",
      "close with a clear call to action",
    ],
    sampleOpeners: [
      "shipping update:",
      "if you build in public, try this:",
    ],
  };
}

function extractVideoId(youtubeUrl: string): string | null {
  try {
    const parsed = new URL(youtubeUrl);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return id;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedPos = parts.findIndex((part) => part === "embed");
      if (embedPos >= 0 && parts[embedPos + 1]) return parts[embedPos + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTranscriptXml(xml: string): string {
  const chunks = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)];
  return chunks
    .map((chunk) => decodeHtml(chunk[1] ?? ""))
    .filter(Boolean)
    .join(" ");
}

function parseTranscriptJson3(json3: string): string {
  try {
    const data = JSON.parse(json3) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };
    const lines =
      data.events
        ?.map((event) =>
          (event.segs ?? [])
            .map((seg) => decodeHtml(seg.utf8 ?? ""))
            .join("")
            .trim()
        )
        .filter(Boolean) ?? [];
    return lines.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function fetchCaptionTracks(videoId: string): Promise<string[]> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) return [];

  const html = await response.text();
  const match = html.match(/"captionTracks":(\[[\s\S]*?\]),"audioTracks"/);
  if (!match?.[1]) return [];

  try {
    const tracks = JSON.parse(match[1]) as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }>;

    const prioritized = tracks.sort((a, b) => {
      const score = (track: { languageCode?: string; kind?: string }) => {
        const lang = (track.languageCode ?? "").toLowerCase();
        const isEnglish = lang === "en" || lang.startsWith("en-");
        const isAsr = track.kind === "asr";
        if (isEnglish && !isAsr) return 4;
        if (isEnglish && isAsr) return 3;
        if (!isEnglish && !isAsr) return 2;
        return 1;
      };
      return score(b) - score(a);
    });

    return prioritized
      .map((track) => track.baseUrl)
      .filter((url): url is string => Boolean(url))
      .map((url) => (url.includes("fmt=") ? url : `${url}&fmt=json3`));
  } catch {
    return [];
  }
}

async function fetchTracksFromTimedtextList(videoId: string): Promise<string[]> {
  const listEndpoints = [
    `https://video.google.com/timedtext?type=list&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
  ];

  let xml = "";
  for (const endpoint of listEndpoints) {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) continue;
    xml = await response.text();
    if (xml.includes("<track")) break;
  }

  if (!xml.includes("<track")) return [];

  const tracks = [...xml.matchAll(/<track\s+([^>]+?)\/>/g)].map((match) => match[1] ?? "");
  type Row = { lang: string; name: string; kind: string };
  const rows: Row[] = tracks.map((attrs) => {
    const read = (key: string) =>
      decodeHtml(attrs.match(new RegExp(`${key}="([^"]*)"`))?.[1] ?? "");
    return {
      lang: read("lang_code"),
      name: read("name"),
      kind: read("kind"),
    };
  });

  const scored = rows.sort((a, b) => {
    const score = (row: Row) => {
      const lang = row.lang.toLowerCase();
      const english = lang === "en" || lang.startsWith("en-");
      const asr = row.kind === "asr";
      if (english && !asr) return 4;
      if (english && asr) return 3;
      if (!english && !asr) return 2;
      return 1;
    };
    return score(b) - score(a);
  });

  return scored.map((row) => {
    const params = new URLSearchParams({
      v: videoId,
      lang: row.lang,
      fmt: "json3",
    });
    if (row.name) params.set("name", row.name);
    if (row.kind) params.set("kind", row.kind);
    return `https://www.youtube.com/api/timedtext?${params.toString()}`;
  });
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  const transcriptFromPkg = await (async () => {
    try {
      const configs = [{ lang: "en" }, { lang: "en-US" }, {}] as const;
      for (const config of configs) {
        try {
          const items = await YoutubeTranscript.fetchTranscript(videoId, config);
          const text = items
            .map((item) => decodeHtml(item.text ?? ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (text.length > 120) return text;
        } catch {
          continue;
        }
      }
      return null;
    } catch {
      return null;
    }
  })();

  if (transcriptFromPkg) return transcriptFromPkg;

  const listTrackUrls = await fetchTracksFromTimedtextList(videoId);
  const dynamicTrackUrls = await fetchCaptionTracks(videoId);
  const urls = [
    ...listTrackUrls,
    ...dynamicTrackUrls,
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en-US&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en-US&kind=asr&v=${videoId}`,
  ];

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) continue;

    const text = await response.text();
    const transcript = text.trim().startsWith("{")
      ? parseTranscriptJson3(text)
      : parseTranscriptXml(text);
    if (transcript.length > 120) return transcript;
  }

  return null;
}

function inferToneFromTranscript(transcript: string): ToneResult {
  const text = transcript.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = transcript
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const avgSentenceLength = sentences.length ? words.length / sentences.length : words.length;
  const antiEstablishmentSignals =
    (text.match(/\b(system|mainstream|institution|authority|narrative|status quo|corporate|propaganda|broken|rigged|scam|bs|bullshit|contrarian|rebel)\b/g) ?? []).length;
  const storySignals = (text.match(/\bi\b|\bmy\b|\btoday\b|\byesterday\b|\bjourney\b/g) ?? []).length;
  const tacticalSignals =
    (text.match(/\bfirst\b|\bthen\b|\bstep\b|\bframework\b|\bstrategy\b|\bprocess\b/g) ?? []).length;
  const opinionSignals = (text.match(/\bi think\b|\bi believe\b|\bwrong\b|\bshould\b|\bhot take\b/g) ?? []).length;

  if (antiEstablishmentSignals >= 3) {
    return {
      toneName: "anti-establishment contrarian",
      summary: "provocative, challenger-energy, and anti-status-quo.",
      styleGuide: [
        "open with the belief you are challenging",
        "name what is broken in plain language",
        "offer a concrete alternative with proof",
      ],
      sampleOpeners: [
        "the mainstream advice is wrong for builders because:",
        "hot take: the system rewards noise, so here is how we play different:",
      ],
    };
  }

  if (tacticalSignals >= storySignals && tacticalSignals >= opinionSignals) {
    return {
      toneName: "educational operator",
      summary: "clear, tactical, and practical with concrete takeaways.",
      styleGuide: [
        "lead with one practical promise",
        "use short direct sentences",
        "close with one action people can do today",
      ],
      sampleOpeners: [
        "if you are shipping this week, start here:",
        "one tactic that moved our numbers today:",
      ],
    };
  }

  if (opinionSignals >= 3) {
    return {
      toneName: "conversational authority",
      summary: "opinionated, social-first, and discussion-driven.",
      styleGuide: [
        "open with a strong claim",
        "invite disagreement without being defensive",
        "back takes with real examples",
      ],
      sampleOpeners: [
        "hot take for builders shipping in public:",
        "most people get this wrong when launching:",
      ],
    };
  }

  if (storySignals >= 4 || avgSentenceLength > 18) {
    return {
      toneName: "story-driven builder",
      summary: "personal, transparent, and momentum-focused.",
      styleGuide: [
        "start with a real moment from today",
        "show what changed since last update",
        "ask for one specific piece of feedback",
      ],
      sampleOpeners: [
        "today was messy, but here is what finally worked:",
        "day update: one win and one mistake:",
      ],
    };
  }

  return {
    toneName: "direct creator",
    summary: "concise, confident, and high-signal.",
    styleGuide: [
      "one idea per post",
      "tight sentences and concrete language",
      "close with a clear call to action",
    ],
    sampleOpeners: [
      "shipping update:",
      "if you build in public, try this:",
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { youtubeUrl?: string; openaiApiKey?: string };
    const youtubeUrl = body.youtubeUrl?.trim();
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";

    if (!youtubeUrl) {
      return NextResponse.json({ ok: false, error: "missing youtube url" }, { status: 400 });
    }

    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(youtubeUrl);
    if (!isYoutube) {
      return NextResponse.json({ ok: false, error: "url must be a youtube link" }, { status: 400 });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ ok: false, error: "could not parse video id" }, { status: 400 });
    }

    const metadataResponse = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`
    );

    if (!metadataResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "could not read video metadata. check the url and visibility." },
        { status: 400 }
      );
    }

    const metadata = (await metadataResponse.json()) as {
      title?: string;
      author_name?: string;
    };

    const transcript = await fetchTranscript(videoId);
    if (transcript) {
      const gptTone = await analyzeToneWithGpt(transcript, openaiApiKey);
      const tone = gptTone ?? inferToneFromTranscript(transcript);
      return NextResponse.json({
        ok: true,
        title: metadata.title ?? "unknown video",
        author: metadata.author_name ?? "unknown creator",
        source: gptTone ? "gpt_transcript" : "transcript",
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        transcriptPreview: transcript.split(/\s+/).slice(0, 45).join(" "),
        tone,
      });
    }

    const fallbackText = `${metadata.title ?? ""}\n${metadata.author_name ?? ""}`;
    const gptFallbackTone = await analyzeToneWithGpt(fallbackText, openaiApiKey);
    const fallbackTone = gptFallbackTone ?? inferToneFromMetadata(
      metadata.title ?? "unknown video",
      metadata.author_name ?? "unknown creator"
    );

    return NextResponse.json({
      ok: true,
      title: metadata.title ?? "unknown video",
      author: metadata.author_name ?? "unknown creator",
      source: gptFallbackTone ? "gpt_metadata_fallback" : "metadata_fallback",
      warning:
        "transcript unavailable for this video. using metadata-based tone inference.",
      wordCount: 0,
      transcriptPreview: "",
      tone: fallbackTone,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "tone analysis failed before completion" },
      { status: 500 }
    );
  }
}
