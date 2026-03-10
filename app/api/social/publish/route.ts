import { NextRequest, NextResponse } from "next/server";
import { publishToX } from "../../../../lib/social/x-publish";

type Platform = "x" | "linkedin" | "tiktok";

type PublishBody = {
  text?: string;
  images?: string[];
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
    const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
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
          }, images)
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
