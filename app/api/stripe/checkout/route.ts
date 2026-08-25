import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLANS, checkoutPriceForPlan, isPlanKey } from "@/lib/plans";
import { isReferralCode } from "@/lib/referrals";
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
    const checkoutPrice = checkoutPriceForPlan(rawPlan);
    const cookieStore = await cookies();
    const storedReferral = cookieStore.get("reallioo_ref")?.value?.toUpperCase();
    const referralCode = isReferralCode(storedReferral) ? storedReferral : undefined;

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = getStripe();
    const checkoutMetadata = {
      user_id: user.id,
      plan: rawPlan,
      ...(referralCode ? { referral_code: referralCode } : {}),
    };
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: checkoutPrice.unitAmount,
          product_data: {
            name: `Reallioo ${plan.name}`,
            description: plan.creditsLabel,
          },
          recurring: plan.mode === "subscription" ? { interval: "month" } : undefined,
        },
      }],
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id,
      metadata: checkoutMetadata,
      subscription_data: plan.mode === "subscription" ? { metadata: checkoutMetadata } : undefined,
      payment_intent_data: plan.mode === "payment" ? { metadata: checkoutMetadata } : undefined,
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
