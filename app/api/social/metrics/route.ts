import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";

type Body = {
  tweetIds?: string[];
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

  return {
    Authorization: `Bearer ${args.xToken}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const tweetIds = Array.from(new Set((body.tweetIds ?? []).filter(Boolean)));
    const xToken = body.connections?.xToken?.trim() ?? "";
    const xApiKey = body.connections?.xApiKey?.trim() ?? "";
    const xApiSecret = body.connections?.xApiSecret?.trim() ?? "";
    const xAccessToken = body.connections?.xAccessToken?.trim() ?? "";
    const xAccessTokenSecret = body.connections?.xAccessTokenSecret?.trim() ?? "";

    const hasAuth =
      Boolean(xToken) ||
      Boolean(xApiKey && xApiSecret && xAccessToken && xAccessTokenSecret);
    if (!hasAuth) {
      return NextResponse.json(
        { ok: false, error: "x credentials missing" },
        { status: 400 }
      );
    }

    const meUrl = "https://api.twitter.com/2/users/me?user.fields=public_metrics";
    const meHeaders = buildHeaders({
      url: meUrl,
      xToken,
      xApiKey,
      xApiSecret,
      xAccessToken,
      xAccessTokenSecret,
    });
    const meRes = await fetch(meUrl, { method: "GET", headers: meHeaders });
    if (!meRes.ok) {
      return NextResponse.json(
        { ok: false, error: `x metrics auth failed (${meRes.status})` },
        { status: 400 }
      );
    }

    const meJson = (await meRes.json()) as {
      data?: {
        id?: string;
        username?: string;
        public_metrics?: { followers_count?: number };
      };
    };
    const followers = meJson.data?.public_metrics?.followers_count ?? 0;
    const account = meJson.data?.username ? `@${meJson.data.username}` : "unknown";

    if (!tweetIds.length) {
      return NextResponse.json({
        ok: true,
        metrics: { views: 0, replies: 0, followers },
        source: "x_live",
        account,
        warning: "no posted tweets saved yet.",
      });
    }

    const tweetsUrl = `https://api.twitter.com/2/tweets?ids=${encodeURIComponent(
      tweetIds.join(",")
    )}&tweet.fields=public_metrics,non_public_metrics`;
    const tweetHeaders = buildHeaders({
      url: tweetsUrl,
      xToken,
      xApiKey,
      xApiSecret,
      xAccessToken,
      xAccessTokenSecret,
    });
    const tweetsRes = await fetch(tweetsUrl, { method: "GET", headers: tweetHeaders });
    if (!tweetsRes.ok) {
      return NextResponse.json({
        ok: true,
        metrics: { views: 0, replies: 0, followers },
        source: "x_live_partial",
        account,
        warning: `tweet metrics unavailable (${tweetsRes.status}). followers is still live.`,
      });
    }

    const tweetsJson = (await tweetsRes.json()) as {
      data?: Array<{
        id?: string;
        public_metrics?: { reply_count?: number };
        non_public_metrics?: { impression_count?: number };
      }>;
    };

    const rows = tweetsJson.data ?? [];
    const replies = rows.reduce(
      (sum, row) => sum + (row.public_metrics?.reply_count ?? 0),
      0
    );
    const views = rows.reduce(
      (sum, row) => sum + (row.non_public_metrics?.impression_count ?? 0),
      0
    );
    const hasImpressions = rows.some(
      (row) => typeof row.non_public_metrics?.impression_count === "number"
    );

    return NextResponse.json({
      ok: true,
      metrics: {
        views,
        replies,
        followers,
      },
      source: "x_live",
      account,
      warning: hasImpressions
        ? null
        : "impression_count unavailable for this x plan/token, views shown as 0.",
      tweetCount: rows.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "metrics request failed before completion" },
      { status: 500 }
    );
  }
}
