import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "./actions";
import GeneratorClient, { type GenerationCard } from "./generator-client";
import ReferralCard from "./referral-card";
import { ensureReferralAccount, referralUrl } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const userId = String(data.claims.sub);
  const [{ data: profile }, { data: generations }] = await Promise.all([
    supabase.from("profiles").select("plan, credits_remaining, is_admin, email").eq("id", userId).maybeSingle(),
    supabase
      .from("generations")
      .select("id, prompt, result_path, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("result_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const admin = createAdminClient();
  const initialGenerations: GenerationCard[] = [];
  for (const generation of generations || []) {
    if (!generation.result_path) continue;
    const { data: signed } = await admin.storage.from("generations").createSignedUrl(generation.result_path, 3600);
    if (!signed?.signedUrl) continue;
    initialGenerations.push({
      id: generation.id,
      prompt: generation.prompt,
      resultUrl: signed.signedUrl,
      createdAt: generation.created_at,
    });
  }

  const planName = profile?.is_admin ? "ADMIN" : (profile?.plan || "free").toUpperCase();
  const credits = profile?.is_admin ? null : Number(profile?.credits_remaining ?? 0);
  const hasPaidAccess = Boolean(profile?.is_admin || (profile?.plan && profile.plan !== "free"));
  let referralData: {
    link: string;
    referrals: number;
    pendingCents: number;
    paidCents: number;
    bankDetails: { configured: boolean; accountHolderName?: string; maskedIban?: string };
  } | null = null;

  if (hasPaidAccess) {
    try {
      const account = await ensureReferralAccount(admin, userId);
      const [{ count }, { data: commissions }, { data: bank }] = await Promise.all([
        admin.from("referral_attributions").select("referred_user_id", { count: "exact", head: true }).eq("referrer_user_id", userId),
        admin.from("referral_commissions").select("commission_cents, status").eq("referrer_user_id", userId),
        admin.from("payout_bank_details").select("account_holder_name, iban_country, iban_last4").eq("user_id", userId).maybeSingle(),
      ]);
      const totals = (commissions || []).reduce((result, commission) => {
        const amount = Number(commission.commission_cents || 0);
        if (commission.status === "paid") result.paidCents += amount;
        if (commission.status === "pending" || commission.status === "approved") result.pendingCents += amount;
        return result;
      }, { pendingCents: 0, paidCents: 0 });
      referralData = {
        link: referralUrl(account.code),
        referrals: count || 0,
        ...totals,
        bankDetails: bank
          ? {
              configured: true,
              accountHolderName: bank.account_holder_name,
              maskedIban: `${bank.iban_country}•• •••• •••• •••• •••• ${bank.iban_last4}`,
            }
          : { configured: false },
      };
    } catch (error) {
      console.error("Referral dashboard unavailable", error);
    }
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <a className="logo" href="/">REALLI<span>OO</span></a>
        <nav>
          <a className="active" href="/dashboard">✦ Créer</a>
          <a href="#history">Mes créations</a>
          <a href="#plan">Mon abonnement</a>
          {referralData && <a href="#ambassador">Ambassadeur</a>}
        </nav>
        <form action={signOut}><button type="submit">Se déconnecter</button></form>
      </aside>
      <section className="dashboard-content">
        <header>
          <div><p>STUDIO PERSONNEL · {planName}</p><h1>Crée l’impossible.</h1></div>
          <span>{credits === null ? "CRÉDITS ILLIMITÉS" : `${credits} CRÉDIT${credits > 1 ? "S" : ""}`}</span>
        </header>

        <GeneratorClient initialCredits={credits} initialGenerations={initialGenerations} />

        {referralData && <ReferralCard {...referralData} />}

        <div className="dashboard-plan" id="plan">
          <div><p>TON ACCÈS</p><h2>{planName}</h2><span>{profile?.is_admin ? "Accès propriétaire illimité" : `${credits ?? 0} crédits disponibles`}</span></div>
          {profile?.is_admin
            ? <a className="yellow-pill" href="/admin/payouts">Gérer les virements →</a>
            : profile?.plan && profile.plan !== "free" && profile.plan !== "lifetime"
              ? <form action="/api/stripe/portal" method="post"><button className="outline-pill" type="submit">Gérer mon abonnement →</button></form>
              : <a className="yellow-pill" href="/#prices">Voir les offres →</a>}
        </div>
      </section>
    </main>
  );
}
