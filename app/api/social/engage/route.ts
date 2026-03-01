import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";

type Body = {
  query?: string;
  productName?: string;
  audience?: string;
  openaiApiKey?: string;
  maxReplies?: number;
  connections?: {
    xToken?: string;
    xApiKey?: string;
    xApiSecret?: string;
    xAccessToken?: string;
    xAccessTokenSecret?: string;
  };
};

type CandidateTweet = {
  id: string;
  text: string;
  score: number;
};

function pct(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function oauth1Header(input: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}): string {
  const parsedUrl = new URL(input.url);
  const queryParams: Record<string, string> = {};
  parsedUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const oauth = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: input.token,
    oauth_version: "1.0",
  };
  const signatureParams = { ...queryParams, ...oauth };
  const sorted = Object.entries(signatureParams).sort(([a], [b]) => a.localeCompare(b));
  const paramString = sorted.map(([k, v]) => `${pct(k)}=${pct(v)}`).join("&");
  const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
  const baseString = `${input.method.toUpperCase()}&${pct(normalizedUrl)}&${pct(paramString)}`;
  const key = `${pct(input.consumerSecret)}&${pct(input.tokenSecret)}`;
  const signature = createHmac("sha1", key).update(baseString).digest("base64");

  const withSig = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.entries(withSig)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ")}`;
}

function getAuthMode(body: Body): "oauth1" | "bearer" | "none" {
  const xToken = body.connections?.xToken?.trim() ?? "";
  const xApiKey = body.connections?.xApiKey?.trim() ?? "";
  const xApiSecret = body.connections?.xApiSecret?.trim() ?? "";
  const xAccessToken = body.connections?.xAccessToken?.trim() ?? "";
  const xAccessTokenSecret = body.connections?.xAccessTokenSecret?.trim() ?? "";
  if (xApiKey && xApiSecret && xAccessToken && xAccessTokenSecret) return "oauth1";
  if (xToken) return "bearer";
  return "none";
}

function authHeaders(url: string, method: "GET" | "POST", body: Body): Record<string, string> {
  const mode = getAuthMode(body);
  const xToken = body.connections?.xToken?.trim() ?? "";
  const xApiKey = body.connections?.xApiKey?.trim() ?? "";
  const xApiSecret = body.connections?.xApiSecret?.trim() ?? "";
  const xAccessToken = body.connections?.xAccessToken?.trim() ?? "";
  const xAccessTokenSecret = body.connections?.xAccessTokenSecret?.trim() ?? "";

  if (mode === "oauth1") {
    return {
      Authorization: oauth1Header({
        method,
        url,
        consumerKey: xApiKey,
        consumerSecret: xApiSecret,
        token: xAccessToken,
        tokenSecret: xAccessTokenSecret,
      }),
      "Content-Type": "application/json",
    };
  }
  return {
    Authorization: `Bearer ${xToken}`,
    "Content-Type": "application/json",
  };
}

async function genReplyWithGpt(
  openaiApiKey: string,
  context: { productName: string; audience: string; targetPost: string }
): Promise<string | null> {
  if (!openaiApiKey) return null;
  const prompt = `
Write one short, high-quality reply to this x post.
Goals:
- add value
- no spam
- no hashtags
- no promo links
- max 220 chars
- natural builder tone

Our product: ${context.productName}
Audience: ${context.audience}
Target post:
${context.targetPost}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "you write concise high-value social replies." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return text.slice(0, 220);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const query = body.query?.trim();
    const productName = body.productName?.trim() ?? "my product";
    const audience = body.audience?.trim() ?? "builders";
    const maxReplies = Math.min(Math.max(body.maxReplies ?? 2, 1), 4);
    const openaiApiKey = body.openaiApiKey?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ ok: false, error: "missing query" }, { status: 400 });
    }
    if (getAuthMode(body) === "none") {
      return NextResponse.json({ ok: false, error: "x credentials missing" }, { status: 400 });
    }

    const tokens = Array.from(
      new Set(
        query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/gi, " ")
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 2)
      )
    ).slice(0, 6);
    const queryExpr =
      tokens.length > 0
        ? tokens.map((t) => `"${t}"`).join(" OR ")
        : '"build" OR "startup" OR "product"';
    const fullQuery = `(${queryExpr}) -is:retweet -is:reply lang:en`;

    let top: CandidateTweet[] = [];
    let source = "recent_search";

    const searchUrl =
      "https://api.twitter.com/2/tweets/search/recent" +
      `?query=${encodeURIComponent(fullQuery)}` +
      "&max_results=12" +
      "&tweet.fields=author_id,public_metrics";
    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: authHeaders(searchUrl, "GET", body),
    });
    if (!searchRes.ok && (searchRes.status === 401 || searchRes.status === 403)) {
      // fallback: mentions timeline
      const meUrl = "https://api.twitter.com/2/users/me";
      const meRes = await fetch(meUrl, {
        method: "GET",
        headers: authHeaders(meUrl, "GET", body),
      });
      if (meRes.ok) {
        const meJson = (await meRes.json()) as { data?: { id?: string } };
        const meId = meJson.data?.id;
        if (meId) {
          const mentionsUrl =
            `https://api.twitter.com/2/users/${meId}/mentions?max_results=12` +
            "&tweet.fields=author_id,public_metrics";
          const mentionsRes = await fetch(mentionsUrl, {
            method: "GET",
            headers: authHeaders(mentionsUrl, "GET", body),
          });
          if (mentionsRes.ok) {
            const mentionJson = (await mentionsRes.json()) as {
              data?: Array<{
                id: string;
                text: string;
                public_metrics?: {
                  like_count?: number;
                  reply_count?: number;
                  retweet_count?: number;
                  quote_count?: number;
                };
              }>;
            };
            top = (mentionJson.data ?? [])
              .map((tweet) => {
                const m = tweet.public_metrics ?? {};
                const score =
                  (m.reply_count ?? 0) * 3 +
                  (m.like_count ?? 0) * 2 +
                  (m.retweet_count ?? 0) * 2 +
                  (m.quote_count ?? 0);
                return { ...tweet, score };
              })
              .sort((a, b) => b.score - a.score)
              .slice(0, maxReplies)
              .map((t) => ({ id: t.id, text: t.text, score: t.score }));
            source = "mentions_fallback";
          }
        }
      }
    }

    if (!searchRes.ok && top.length === 0) {
      let detail = "";
      try {
        const err = (await searchRes.json()) as {
          detail?: string;
          title?: string;
          errors?: Array<{ message?: string }>;
        };
        detail = err.detail || err.title || err.errors?.[0]?.message || "";
      } catch {
        detail = "";
      }
      return NextResponse.json(
        { ok: false, error: `x search failed (${searchRes.status}) ${detail}`.trim() },
        { status: 400 }
      );
    }

    if (top.length === 0) {
      const searchJson = (await searchRes.json()) as {
        data?: Array<{
          id: string;
          text: string;
          public_metrics?: {
            like_count?: number;
            reply_count?: number;
            retweet_count?: number;
            quote_count?: number;
          };
        }>;
      };
      top = (searchJson.data ?? [])
        .map((tweet) => {
          const m = tweet.public_metrics ?? {};
          const score =
            (m.reply_count ?? 0) * 3 +
            (m.like_count ?? 0) * 2 +
            (m.retweet_count ?? 0) * 2 +
            (m.quote_count ?? 0);
          return { ...tweet, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxReplies)
        .map((t) => ({ id: t.id, text: t.text, score: t.score }));
    }

    const results: Array<{ tweetId: string; ok: boolean; message: string; replyId?: string }> = [];
    for (const tweet of top) {
      const generated =
        (await genReplyWithGpt(openaiApiKey, {
          productName,
          audience,
          targetPost: tweet.text,
        })) ??
        `great point. we are building ${productName} for ${audience}, and this is exactly the kind of signal we are seeing too.`;

      const postUrl = "https://api.twitter.com/2/tweets";
      const postRes = await fetch(postUrl, {
        method: "POST",
        headers: authHeaders(postUrl, "POST", body),
        body: JSON.stringify({
          text: generated,
          reply: { in_reply_to_tweet_id: tweet.id },
        }),
      });
      if (!postRes.ok) {
        results.push({
          tweetId: tweet.id,
          ok: false,
          message: `reply failed (${postRes.status})`,
        });
        continue;
      }
      const postJson = (await postRes.json()) as { data?: { id?: string } };
      results.push({
        tweetId: tweet.id,
        ok: true,
        message: "reply posted",
        replyId: postJson.data?.id,
      });
    }

    return NextResponse.json({
      ok: true,
      results,
      repliedCount: results.filter((r) => r.ok).length,
      attempted: results.length,
      source,
      warning:
        source === "mentions_fallback"
          ? "x recent search unavailable. replies were generated from mentions timeline."
          : null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "engage failed" }, { status: 500 });
  }
}
