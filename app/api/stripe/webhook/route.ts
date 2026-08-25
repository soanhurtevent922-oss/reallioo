import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { creditsForPlan, isPlanKey, type PlanKey } from "@/lib/plans";
import { ensureReferralAccount, isReferralCode, referralUrl, sendReferralEmail } from "@/lib/referrals";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function idOf(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id || null;
}

async function activatePlan(userId: string, plan: PlanKey, customerId: string | null, subscriptionId: string | null) {
  const admin = createAdminClient();
  const resetAt = plan === "lifetime" ? null : new Date(Date.now() + 31 * 86400000).toISOString();
  const profileResult = await admin.from("profiles").update({
    plan,
    credits_remaining: creditsForPlan(plan),
    credits_reset_at: resetAt,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (profileResult.error) throw profileResult.error;

  const subscriptionResult = await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan,
    status: "active",
    updated_at: new Date().toISOString(),
  });
  if (subscriptionResult.error) throw subscriptionResult.error;
}

async function ensureAttribution(
  admin: ReturnType<typeof createAdminClient>,
  referredUserId: string,
  plan: PlanKey,
  referralCode: string | null | undefined,
  subscriptionId: string | null,
) {
  const existing = await admin
    .from("referral_attributions")
    .select("referrer_user_id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (existing.data?.referrer_user_id) return String(existing.data.referrer_user_id);
  if (existing.error || !isReferralCode(referralCode)) return null;

  const account = await admin
    .from("referral_accounts")
    .select("user_id")
    .eq("code", referralCode)
    .maybeSingle();
  const referrerUserId = account.data?.user_id ? String(account.data.user_id) : null;
  if (!referrerUserId || referrerUserId === referredUserId) return null;

  const created = await admin.from("referral_attributions").insert({
    referred_user_id: referredUserId,
    referrer_user_id: referrerUserId,
    referral_code: referralCode,
    stripe_subscription_id: subscriptionId,
    plan,
  });
  if (!created.error) return referrerUserId;
  if (created.error.code !== "23505") {
    console.error("Referral attribution could not be recorded", created.error);
    return null;
  }

  const concurrent = await admin
    .from("referral_attributions")
    .select("referrer_user_id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  return concurrent.data?.referrer_user_id ? String(concurrent.data.referrer_user_id) : null;
}

async function recordCommission(
  admin: ReturnType<typeof createAdminClient>,
  values: {
    referrerUserId: string;
    referredUserId: string;
    stripePaymentId: string;
    plan: PlanKey;
    paymentKind: "subscription" | "lifetime";
    grossAmountCents: number;
  },
) {
  const commissionPercent = values.paymentKind === "lifetime" ? 50 : 20;
  const commissionCents = Math.round(values.grossAmountCents * (commissionPercent / 100));
  if (commissionCents <= 0) return;
  const result = await admin.from("referral_commissions").insert({
    referrer_user_id: values.referrerUserId,
    referred_user_id: values.referredUserId,
    stripe_payment_id: values.stripePaymentId,
    plan: values.plan,
    payment_kind: values.paymentKind,
    gross_amount_cents: values.grossAmountCents,
    commission_cents: commissionCents,
    commission_percent: commissionPercent,
    status: "pending",
  });
  if (result.error && result.error.code !== "23505") {
    console.error("Referral commission could not be recorded", result.error);
  }
}

async function processEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    const plan = session.metadata?.plan;
    if (userId && plan && isPlanKey(plan)) {
      const subscriptionId = idOf(session.subscription);
      await activatePlan(userId, plan, idOf(session.customer), subscriptionId);
      const activityResult = await admin.from("purchase_activity").insert({ plan });
      if (activityResult.error) {
        console.error("Purchase activity could not be recorded", activityResult.error);
      }

      try {
        const account = await ensureReferralAccount(admin, userId);
        const email = session.customer_details?.email;
        if (email && !account.email_sent_at) {
          const sent = await sendReferralEmail(email, referralUrl(account.code));
          if (sent) {
            await admin.from("referral_accounts").update({ email_sent_at: new Date().toISOString() }).eq("user_id", userId);
          }
        }
      } catch (error) {
        console.error("Referral account or e-mail could not be prepared", error);
      }

      const referrerUserId = await ensureAttribution(
        admin,
        userId,
        plan,
        session.metadata?.referral_code,
        subscriptionId,
      );
      if (referrerUserId && plan === "lifetime" && session.payment_status === "paid") {
        await recordCommission(admin, {
          referrerUserId,
          referredUserId: userId,
          stripePaymentId: `checkout:${session.id}`,
          plan,
          paymentKind: "lifetime",
          grossAmountCents: session.amount_total || 0,
        });
      }
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const parent = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = idOf(parent || null);
    if (subscriptionId) {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.user_id;
      const plan = subscription.metadata.plan;
      if (userId && plan && isPlanKey(plan)) {
        await activatePlan(userId, plan, idOf(subscription.customer), subscription.id);
        const referrerUserId = await ensureAttribution(
          admin,
          userId,
          plan,
          subscription.metadata.referral_code,
          subscription.id,
        );
        if (referrerUserId) {
          await recordCommission(admin, {
            referrerUserId,
            referredUserId: userId,
            stripePaymentId: invoice.id,
            plan,
            paymentKind: "subscription",
            grossAmountCents: invoice.amount_paid,
          });
        }
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.user_id;
    if (userId) {
      const profileResult = await admin.from("profiles").update({ plan: "free", credits_remaining: 0, credits_reset_at: null, updated_at: new Date().toISOString() }).eq("id", userId);
      if (profileResult.error) throw profileResult.error;
      const subscriptionResult = await admin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", userId);
      if (subscriptionResult.error) throw subscriptionResult.error;
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("Invalid Stripe webhook", error);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const marker = await admin.from("stripe_events").insert({ event_id: event.id });
  if (marker.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (marker.error) return NextResponse.json({ error: "Stockage webhook impossible" }, { status: 500 });

  try {
    await processEvent(event);
    await admin.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error", error);
    await admin.from("stripe_events").delete().eq("event_id", event.id);
    return NextResponse.json({ error: "Traitement impossible" }, { status: 500 });
  }
}
