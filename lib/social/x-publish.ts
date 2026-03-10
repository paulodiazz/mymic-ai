import { createHmac, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";

export type XAuth = {
  xToken: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
};

export type XPublishResult = {
  platform: "x";
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

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:image")) {
    const base64 = url.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`image download failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadMediaToX(
  imageUrl: string,
  auth: {
    xApiKey: string;
    xApiSecret: string;
    xAccessToken: string;
    xAccessTokenSecret: string;
  }
): Promise<string> {
  const mediaEndpoint = "https://upload.twitter.com/1.1/media/upload.json";
  const buffer = await fetchImageBuffer(imageUrl);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append("media", blob, "image.png");

  const headers: Record<string, string> = {
    Authorization: oauth1Header({
      method: "POST",
      url: mediaEndpoint,
      consumerKey: auth.xApiKey,
      consumerSecret: auth.xApiSecret,
      token: auth.xAccessToken,
      tokenSecret: auth.xAccessTokenSecret,
    }),
  };

  const response = await fetch(mediaEndpoint, {
    method: "POST",
    headers,
    body: form,
  });
  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as { error?: string; errors?: Array<{ message?: string }> };
      detail = err.error || err.errors?.[0]?.message || "";
    } catch {
      detail = "";
    }
    throw new Error(`x media upload failed (${response.status}) ${detail}`.trim());
  }
  const data = (await response.json()) as { media_id_string?: string; media_id?: string };
  const mediaId = data.media_id_string || (data.media_id ? String(data.media_id) : "");
  if (!mediaId) {
    throw new Error("x media upload returned empty media id");
  }
  return mediaId;
}

export async function publishToX(
  text: string,
  context: { campaignId: string; day: number },
  auth: XAuth,
  images: string[] = [],
  options: { allowDuplicateSuffix?: boolean } = {}
): Promise<XPublishResult> {
  const hasBearer = Boolean(auth.xToken);
  const hasOauth1 = Boolean(
    auth.xApiKey && auth.xApiSecret && auth.xAccessToken && auth.xAccessTokenSecret
  );
  const allowDuplicateSuffix = options.allowDuplicateSuffix !== false;

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
  const imageList = images.filter(Boolean).slice(0, 4);

  if (imageList.length > 0 && !hasOauth1) {
    return {
      platform: "x",
      ok: false,
      message: "x image uploads require oauth1 user tokens (api key/secret + access token/secret).",
    };
  }

  let mediaIds: string[] = [];
  if (imageList.length > 0) {
    try {
      for (const url of imageList) {
        const mediaId = await uploadMediaToX(url, {
          xApiKey: auth.xApiKey,
          xApiSecret: auth.xApiSecret,
          xAccessToken: auth.xAccessToken,
          xAccessTokenSecret: auth.xAccessTokenSecret,
        });
        mediaIds.push(mediaId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "x media upload failed.";
      return {
        platform: "x",
        ok: false,
        message,
      };
    }
  }

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

    const payload = mediaIds.length > 0 ? { text, media: { media_ids: mediaIds } } : { text };
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      data = (await response.json()) as { data?: { id?: string } };
      lastError = "";
      break;
    }

    // Retry once with unique suffix when x rejects duplicate content.
    if (response.status === 403 && allowDuplicateSuffix) {
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
        const retryPayload = mediaIds.length > 0
          ? { text: unique.slice(0, 270), media: { media_ids: mediaIds } }
          : { text: unique.slice(0, 270) };
        const retryRes = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(retryPayload),
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
