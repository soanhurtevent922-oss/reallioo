import { NextResponse } from "next/server";
import { PLANS, isPlanKey } from "@/lib/plans";
import { getSiteUrl, getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.redirect(`${getSiteUrl()}/login`, 303);

    const form = await request.formData();
    const rawPlan = String(form.get("plan") || "");
    if (!isPlanKey(rawPlan)) return NextResponse.json({ error: "Offre inconnue" }, { status: 400 });

    const plan = PLANS[rawPlan];
    const price = process.env[plan.env];
    if (!price) throw new Error(`${plan.env} manquante`);

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      line_items: [{ price, quantity: 1 }],
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan: rawPlan },
      subscription_data: plan.mode === "subscription" ? { metadata: { user_id: user.id, plan: rawPlan } } : undefined,
      payment_intent_data: plan.mode === "payment" ? { metadata: { user_id: user.id, plan: rawPlan } } : undefined,
      success_url: `${getSiteUrl()}/dashboard?payment=success`,
      cancel_url: `${getSiteUrl()}/checkout/${rawPlan}?payment=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error("Stripe n'a pas retourné de page de paiement");
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Stripe checkout error", error);
    return NextResponse.json({ error: "Impossible d'ouvrir le paiement Stripe." }, { status: 500 });
  }
}
