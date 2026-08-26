import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PLANS, checkoutPriceForPlan, isPlanKey } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StartPlanPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan: rawPlan } = await params;
  if (!isPlanKey(rawPlan)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/checkout/${rawPlan}`);

  const plan = PLANS[rawPlan];
  const checkoutPrice = checkoutPriceForPlan(rawPlan);
  const next = encodeURIComponent(`/checkout/${rawPlan}`);

  return (
    <main className="checkout-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <section className="checkout-card">
        <p>AVANT DE CONTINUER</p>
        <h1>Relie l’offre<br />à ton compte.</h1>
        <p className="checkout-choice-copy">
          Crée ton compte ou connecte-toi pour rattacher ton abonnement et ton paiement à ton espace Reallioo.
        </p>
        <div className="checkout-summary">
          <span>Offre {plan.name.toLowerCase()} · {plan.creditsLabel}</span>
          <strong>{checkoutPrice.price}<small>{plan.cadence}</small></strong>
        </div>
        <div className="checkout-choice-actions">
          <Link className="yellow-pill" href={`/register?next=${next}`}>Créer mon compte →</Link>
          <Link className="outline-pill" href={`/login?next=${next}`}>J’ai déjà un compte</Link>
        </div>
        <span className="checkout-choice-note">Aucun paiement ne peut être lancé sans compte connecté.</span>
        <Link className="checkout-back" href="/#prices">← Revenir aux offres</Link>
      </section>
    </main>
  );
}
