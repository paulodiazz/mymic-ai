import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";

type Platform = "x" | "linkedin" | "tiktok";

type PublishBody = {
  text?: string;
  campaignId?: string;
  day?: number;
  platforms?: Platform[];
  connections?: {
    xToken?: string;
    xApiKey?: string;
    xApiSecret?: string;
    xAccessToken?: string;
    xAccessTokenSecret?: string;
    linkedinToken?: string;
    linkedinAuthorUrn?: string;
  };
};

type PublishResult = {
  platform: Platform;
  ok: boolean;
  message: string;
  postId?: string;
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

async function publishToX(
  text: string,
  context: { campaignId: string; day: number },
  auth: {
    xToken: string;
    xApiKey: string;
    xApiSecret: string;
    xAccessToken: string;
    xAccessTokenSecret: string;
  }
): Promise<PublishResult> {
  const hasBearer = Boolean(auth.xToken);
  const hasOauth1 = Boolean(
    auth.xApiKey && auth.xApiSecret && auth.xAccessToken && auth.xAccessTokenSecret
  );

  if (!hasBearer && !hasOauth1) {
    return {
      platform: "x",
      ok: false,
      message:
        "x is not connected yet. add oauth2 user token or oauth1 api key/secret + access token/secret.",
    };
  }

  const endpoints = ["https://api.x.com/2/tweets", "https://api.twitter.com/2/tweets"];
  const authMode = hasOauth1 ? "oauth1_user_context" : "bearer_token";
  let lastError = "x publish failed. check token scopes (tweet.write) and app access.";
  let data: { data?: { id?: string } } | null = null;

  const buildHeaders = (endpoint: string): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (hasOauth1) {
      headers.Authorization = oauth1Header({
        method: "POST",
        url: endpoint,
        consumerKey: auth.xApiKey,
        consumerSecret: auth.xApiSecret,
        token: auth.xAccessToken,
        tokenSecret: auth.xAccessTokenSecret,
      });
    } else {
      headers.Authorization = `Bearer ${auth.xToken}`;
    }
    return headers;
  };

  // Preflight identity check with same auth credentials.
  const meEndpoint = "https://api.twitter.com/2/users/me";
  const meHeaders: Record<string, string> = hasOauth1
    ? {
        Authorization: oauth1Header({
          method: "GET",
          url: meEndpoint,
          consumerKey: auth.xApiKey,
          consumerSecret: auth.xApiSecret,
          token: auth.xAccessToken,
          tokenSecret: auth.xAccessTokenSecret,
        }),
      }
    : { Authorization: `Bearer ${auth.xToken}` };

  const meRes = await fetch(meEndpoint, { method: "GET", headers: meHeaders });
  if (!meRes.ok) {
    let meDetail = "";
    try {
      const meErr = (await meRes.json()) as {
        detail?: string;
        title?: string;
        errors?: Array<{ message?: string }>;
      };
      meDetail = meErr.detail || meErr.title || meErr.errors?.[0]?.message || "";
    } catch {
      meDetail = "";
    }
    return {
      platform: "x",
      ok: false,
      message: `x auth preflight failed (${meRes.status}) [${authMode}]. ${meDetail}`.trim(),
    };
  }

  let meUser = "";
  try {
    const meJson = (await meRes.json()) as {
      data?: { id?: string; username?: string; name?: string };
    };
    meUser = meJson.data?.username
      ? `@${meJson.data.username} (${meJson.data?.id ?? "id?"})`
      : meJson.data?.id ?? "";
  } catch {
    meUser = "";
  }

  for (const endpoint of endpoints) {
    const headers = buildHeaders(endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      data = (await response.json()) as { data?: { id?: string } };
      lastError = "";
      break;
    }

    // Retry once with unique suffix when x rejects duplicate content.
    if (response.status === 403) {
      let detail403 = "";
      try {
        const e403 = (await response.json()) as {
          detail?: string;
          title?: string;
          errors?: Array<{ message?: string }>;
        };
        detail403 = e403.detail || e403.title || e403.errors?.[0]?.message || "";
      } catch {
        detail403 = "";
      }
      if (/duplicate content/i.test(detail403)) {
        const unique = `${text}\n\nupdate d${context.day}-${context.campaignId.slice(-4)}`;
        const retryRes = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: unique.slice(0, 270) }),
        });
        if (retryRes.ok) {
          data = (await retryRes.json()) as { data?: { id?: string } };
          lastError = "";
          break;
        }
      }
    }

    let detail = "";
    try {
      const errorJson = (await response.json()) as {
        title?: string;
        detail?: string;
        errors?: Array<{ message?: string }>;
      };
      detail =
        errorJson.detail ||
        errorJson.title ||
        errorJson.errors?.[0]?.message ||
        "";
    } catch {
      detail = "";
    }

    const suffix = detail ? ` ${detail}` : "";
    const authHint = !hasOauth1 && hasBearer
      ? " token appears app-only. use oauth2 user-context token or oauth1 user tokens."
      : "";
    lastError = `x publish failed (${response.status}) [${authMode}].${suffix}${authHint}`.trim();
  }

  if (!data) {
    return {
      platform: "x",
      ok: false,
      message: lastError,
    };
  }

  return {
    platform: "x",
    ok: true,
    message: `posted to x ${meUser ? `as ${meUser}` : ""}`.trim(),
    postId: data?.data?.id,
  };
}

async function publishToLinkedIn(
  text: string,
  token: string,
  authorUrn: string
): Promise<PublishResult> {
  if (!token || !authorUrn) {
    return {
      platform: "linkedin",
      ok: false,
      message: "linkedin is not connected yet. add token + author urn first.",
    };
  }

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!response.ok) {
    return {
      platform: "linkedin",
      ok: false,
      message: "linkedin publish failed. check token scope (w_member_social) and author urn.",
    };
  }

  const postUrn = response.headers.get("x-restli-id") ?? undefined;

  return {
    platform: "linkedin",
    ok: true,
    message: "posted to linkedin",
    postId: postUrn,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublishBody;
    const text = body.text?.trim();
    const campaignId = body.campaignId?.trim() ?? "camp";
    const day = body.day ?? 1;
    const platforms = body.platforms ?? [];
    const xToken = body.connections?.xToken?.trim() ?? "";
    const xApiKey = body.connections?.xApiKey?.trim() ?? "";
    const xApiSecret = body.connections?.xApiSecret?.trim() ?? "";
    const xAccessToken = body.connections?.xAccessToken?.trim() ?? "";
    const xAccessTokenSecret = body.connections?.xAccessTokenSecret?.trim() ?? "";
    const linkedinToken = body.connections?.linkedinToken?.trim() ?? "";
    const linkedinAuthorUrn = body.connections?.linkedinAuthorUrn?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "missing post text" },
        { status: 400 }
      );
    }

    if (!platforms.length) {
      return NextResponse.json(
        { ok: false, error: "choose at least one platform" },
        { status: 400 }
      );
    }

    const results: PublishResult[] = [];

    for (const platform of platforms) {
      if (platform === "x") {
        results.push(
          await publishToX(text, {
            campaignId,
            day,
          }, {
            xToken,
            xApiKey,
            xApiSecret,
            xAccessToken,
            xAccessTokenSecret,
          })
        );
        continue;
      }

      if (platform === "linkedin") {
        results.push(await publishToLinkedIn(text, linkedinToken, linkedinAuthorUrn));
        continue;
      }

      results.push({
        platform: "tiktok",
        ok: false,
        message:
          "tiktok direct post api is not enabled in this build yet. keep this for manual posting.",
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json(
      { ok: false, error: "publish request failed before sending to platforms" },
      { status: 500 }
    );
  }
}
