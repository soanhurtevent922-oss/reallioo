import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PLANS, checkoutPriceForPlan, isPlanKey } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan: rawPlan } = await params;
  if (!isPlanKey(rawPlan)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/${rawPlan}`)}`);

  const plan = PLANS[rawPlan];
  const checkoutPrice = checkoutPriceForPlan(rawPlan);
  return (
    <main className="checkout-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <section className="checkout-card">
        <p>PAIEMENT SÉCURISÉ PAR STRIPE</p>
        <h1>Ton offre<br />{plan.name.toLowerCase()}.</h1>
        <div className="checkout-summary">
          <span>{plan.creditsLabel}</span>
          <strong>{checkoutPrice.price}<small>{plan.cadence}</small></strong>
        </div>
        {checkoutPrice.promotional && <p className="checkout-promo">OFFRE LIMITÉE · AU LIEU DE 19,99 € · JUSQU’AU 15 SEPTEMBRE</p>}
        <ul><li>✓ Résultats haute définition</li><li>✓ Image de référence</li><li>✓ Créations privées</li></ul>
        <form action="/api/stripe/checkout" method="post">
          <input type="hidden" name="plan" value={rawPlan} />
          <button className="yellow-pill" type="submit">Continuer vers Stripe →</button>
        </form>
        <Link className="checkout-back" href="/#prices">← Revenir aux offres</Link>
      </section>
    </main>
  );
}
