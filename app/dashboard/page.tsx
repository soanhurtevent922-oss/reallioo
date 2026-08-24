import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const userId = String(data.claims.sub);
  const { data: profile } = await supabase.from("profiles").select("plan, credits_remaining, is_admin").eq("id", userId).maybeSingle();
  const planName = profile?.is_admin ? "ADMIN" : (profile?.plan || "free").toUpperCase();
  const credits = profile?.is_admin ? "ILLIMITÉS" : String(profile?.credits_remaining ?? 0);

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <a className="logo" href="/">REALLI<span>OO</span></a>
        <nav><a className="active" href="/dashboard">✦ Créer</a><a href="#history">Mes créations</a><a href="#plan">Mon abonnement</a></nav>
        <form action={signOut}><button type="submit">Se déconnecter</button></form>
      </aside>
      <section className="dashboard-content">
        <header><div><p>STUDIO PERSONNEL · {planName}</p><h1>Crée l’impossible.</h1></div><span>{credits} CRÉDITS</span></header>
        <div className="dashboard-generator">
          <div className="dashboard-upload"><strong>＋</strong><h2>Ajoute ta photo</h2><p>JPG, PNG ou WEBP</p></div>
          <div className="dashboard-prompt"><p>CE QUE TU VEUX MODIFIER</p><textarea placeholder="Exemple : remplace la voiture par une Porsche noire et conserve exactement le même décor…" /><button className="yellow-pill">Générer ma photo →</button></div>
        </div>
        <div className="dashboard-empty" id="history"><p>TES CRÉATIONS</p><h2>Tes prochaines images apparaîtront ici.</h2><span>Chaque génération terminée apparaîtra automatiquement dans cet espace.</span></div>
        <div className="dashboard-plan" id="plan"><div><p>TON ACCÈS</p><h2>{planName}</h2><span>{profile?.is_admin ? "Accès propriétaire illimité" : `${credits} crédits disponibles`}</span></div>{profile?.plan && profile.plan !== "free" && profile.plan !== "lifetime" ? <form action="/api/stripe/portal" method="post"><button className="outline-pill" type="submit">Gérer mon abonnement →</button></form> : <a className="yellow-pill" href="/#prices">Voir les offres →</a>}</div>
      </section>
    </main>
  );
}
