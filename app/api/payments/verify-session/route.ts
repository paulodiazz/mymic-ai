import { NextResponse } from "next/server";

const STRIPE_API = "https://api.stripe.com/v1";

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      return NextResponse.json(
        { ok: false, error: "missing STRIPE_SECRET_KEY on server." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ ok: false, error: "missing session id." }, { status: 400 });
    }

    const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions/${body.sessionId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const stripeData = (await stripeRes.json()) as {
      payment_status?: string;
      status?: string;
      error?: { message?: string };
    };

    if (!stripeRes.ok) {
      const error = stripeData.error?.message ?? "stripe verify failed.";
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const paid =
      stripeData.payment_status === "paid" ||
      (stripeData.payment_status === "no_payment_required" && stripeData.status === "complete");
    if (!paid) {
      return NextResponse.json({ ok: false, error: "payment not completed." }, { status: 400 });
    }

    const end = new Date();
    end.setDate(end.getDate() + 14);
    return NextResponse.json({ ok: true, paid: true, planEndsAt: end.toISOString() });
  } catch {
    return NextResponse.json({ ok: false, error: "payment verify request failed." }, { status: 500 });
  }
}

