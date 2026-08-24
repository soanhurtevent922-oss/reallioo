import { NextResponse } from "next/server";
import { getSiteUrl, getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${getSiteUrl()}/login`, 303);

  const { data } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) return NextResponse.redirect(`${getSiteUrl()}/#prices`, 303);

  const session = await getStripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${getSiteUrl()}/dashboard`,
  });
  return NextResponse.redirect(session.url, 303);
}
