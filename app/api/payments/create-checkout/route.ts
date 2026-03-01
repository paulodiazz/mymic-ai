import { NextResponse } from "next/server";

const STRIPE_API = "https://api.stripe.com/v1";

function appUrlFromRequest(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      return NextResponse.json(
        { ok: false, error: "missing STRIPE_SECRET_KEY on server." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as { userId?: string; email?: string };
    if (!body.userId) {
      return NextResponse.json({ ok: false, error: "missing user id." }, { status: 400 });
    }

    const appUrl = appUrlFromRequest(req);
    const successUrl = `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/?checkout=cancel`;

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", successUrl);
    form.set("cancel_url", cancelUrl);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", "1000");
    form.set("line_items[0][price_data][product_data][name]", "Mymic AI - 14 Day Campaign");
    form.set("metadata[user_id]", body.userId);
    form.set("metadata[plan_days]", "14");
    if (body.email) form.set("customer_email", body.email);

    const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const stripeData = (await stripeRes.json()) as {
      url?: string;
      error?: { message?: string };
    };

    if (!stripeRes.ok || !stripeData.url) {
      const error = stripeData.error?.message ?? "stripe checkout creation failed.";
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, url: stripeData.url });
  } catch {
    return NextResponse.json({ ok: false, error: "checkout request failed." }, { status: 500 });
  }
}

