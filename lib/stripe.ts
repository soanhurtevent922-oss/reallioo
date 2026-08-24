import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  return new Stripe(key);
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.reallioo.com").replace(/\/$/, "");
}
