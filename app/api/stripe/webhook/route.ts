import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { creditsForPlan, isPlanKey, type PlanKey } from "@/lib/plans";
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

async function processEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    const plan = session.metadata?.plan;
    if (userId && plan && isPlanKey(plan)) {
      await activatePlan(userId, plan, idOf(session.customer), idOf(session.subscription));
      const activityResult = await admin.from("purchase_activity").insert({ plan });
      if (activityResult.error) {
        console.error("Purchase activity could not be recorded", activityResult.error);
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
