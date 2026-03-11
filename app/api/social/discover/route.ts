import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";

type Body = {
  query?: string;
  productName?: string;
  productType?: string;
  audience?: string;
  maxResults?: number;
  connections?: {
    xToken?: string;
    xApiKey?: string;
    xApiSecret?: string;
    xAccessToken?: string;
    xAccessTokenSecret?: string;
  };
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

function buildHeaders(args: {
  url: string;
  xToken: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
}): Record<string, string> {
  const hasOauth1 = Boolean(
    args.xApiKey && args.xApiSecret && args.xAccessToken && args.xAccessTokenSecret
  );
  if (hasOauth1) {
    return {
      Authorization: oauth1Header({
        method: "GET",
        url: args.url,
        consumerKey: args.xApiKey,
        consumerSecret: args.xApiSecret,
        token: args.xAccessToken,
        tokenSecret: args.xAccessTokenSecret,
      }),
    };
  }
  return { Authorization: `Bearer ${args.xToken}` };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const query = body.query?.trim();
    const maxResults = Math.min(Math.max(body.maxResults ?? 40, 10), 100);
    const productName = body.productName?.trim() ?? "";
    const productType = body.productType?.trim() ?? "";
    const audience = body.audience?.trim() ?? "";
    const xToken = body.connections?.xToken?.trim() ?? "";
    const xApiKey = body.connections?.xApiKey?.trim() ?? "";
    const xApiSecret = body.connections?.xApiSecret?.trim() ?? "";
    const xAccessToken = body.connections?.xAccessToken?.trim() ?? "";
    const xAccessTokenSecret = body.connections?.xAccessTokenSecret?.trim() ?? "";

    const hasAuth =
      Boolean(xToken) ||
      Boolean(xApiKey && xApiSecret && xAccessToken && xAccessTokenSecret);
    if (!hasAuth) {
      return NextResponse.json({ ok: false, error: "x credentials missing" }, { status: 400 });
    }
    const sourceText = [query, productName, productType, audience]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!sourceText) {
      return NextResponse.json({ ok: false, error: "missing query inputs" }, { status: 400 });
    }

    const tokenSource = sourceText.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
    const tokens = tokenSource
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    const phrases = [productName, productType, audience, query]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v && v.length > 2));
    const terms = Array.from(new Set([...phrases, ...tokens])).slice(0, 10);
    const queryExpr = terms.map((t) => `"${t}"`).join(" OR ");
    const fullQuery = `(${queryExpr}) -is:retweet -is:reply lang:en`;

    const searchUrl =
      "https://api.twitter.com/2/tweets/search/recent" +
      `?query=${encodeURIComponent(fullQuery)}` +
      `&max_results=${maxResults}` +
      "&sort_order=relevancy" +
      "&tweet.fields=author_id,created_at,public_metrics" +
      "&expansions=author_id" +
      "&user.fields=username,name";

    const headers = buildHeaders({
      url: searchUrl,
      xToken,
      xApiKey,
      xApiSecret,
      xAccessToken,
      xAccessTokenSecret,
    });

    const response = await fetch(searchUrl, { method: "GET", headers });
    if (!response.ok) {
      let detail = "";
      try {
        const err = (await response.json()) as {
          detail?: string;
          title?: string;
          errors?: Array<{ message?: string }>;
        };
        detail = err.detail || err.title || err.errors?.[0]?.message || "";
      } catch {
        detail = "";
      }
      return NextResponse.json(
        { ok: false, error: `x discover failed (${response.status}) ${detail}`.trim() },
        { status: 400 }
      );
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at?: string;
        public_metrics?: {
          like_count?: number;
          reply_count?: number;
          retweet_count?: number;
          quote_count?: number;
        };
      }>;
      includes?: { users?: Array<{ id: string; username?: string; name?: string }> };
    };

    const users = new Map(
      (data.includes?.users ?? []).map((u) => [u.id, { username: u.username, name: u.name }])
    );

    const posts = (data.data ?? [])
      .map((tweet) => {
        const metrics = tweet.public_metrics ?? {};
        const score =
          (metrics.reply_count ?? 0) * 3 +
          (metrics.like_count ?? 0) * 2 +
          (metrics.retweet_count ?? 0) * 2 +
          (metrics.quote_count ?? 0);
        const author = users.get(tweet.author_id);
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at ?? "",
          authorUsername: author?.username ?? "unknown",
          authorName: author?.name ?? "unknown",
          metrics: metrics,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      posts,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "discover failed" }, { status: 500 });
  }
}
