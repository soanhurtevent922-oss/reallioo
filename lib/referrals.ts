import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanKey } from "@/lib/plans";
import { getSiteUrl } from "@/lib/stripe";

export const REFERRAL_COMMISSION_PERCENT: Record<PlanKey, number> = {
  starter: 40,
  creator: 50,
  lifetime: 50,
};

export function referralCommissionPercent(plan: PlanKey) {
  return REFERRAL_COMMISSION_PERCENT[plan];
}

export type ReferralAccount = {
  user_id: string;
  code: string;
  email_sent_at: string | null;
};

export function isReferralCode(value: string | undefined | null) {
  return Boolean(value && /^[A-Z0-9]{8,20}$/.test(value));
}

function newReferralCode() {
  return `R${crypto.randomUUID().replaceAll("-", "").slice(0, 11).toUpperCase()}`;
}

export async function ensureReferralAccount(admin: SupabaseClient, userId: string) {
  const existing = await admin
    .from("referral_accounts")
    .select("user_id, code, email_sent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as ReferralAccount;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const created = await admin
      .from("referral_accounts")
      .insert({ user_id: userId, code: newReferralCode() })
      .select("user_id, code, email_sent_at")
      .single();
    if (!created.error && created.data) return created.data as ReferralAccount;
    if (created.error?.code !== "23505") throw created.error;

    const concurrent = await admin
      .from("referral_accounts")
      .select("user_id, code, email_sent_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (concurrent.data) return concurrent.data as ReferralAccount;
  }

  throw new Error("Impossible de créer le lien ambassadeur");
}

export function referralUrl(code: string) {
  return `${getSiteUrl()}/?ref=${encodeURIComponent(code)}`;
}

export async function sendReferralEmail(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Ton lien ambassadeur Reallioo est prêt",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111"><h1 style="font-size:30px">Ton lien est prêt ✦</h1><p>Merci de faire partie de Reallioo.</p><p>Partage ton lien personnel. Tu gagnes <strong>40 % de chaque mensualité Starter</strong> et <strong>50 % de chaque mensualité Créateur</strong> tant que l’abonnement apporté reste actif. Si la personne choisit l’accès à vie, tu gagnes <strong>50 % du paiement unique</strong>.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#ffd400;color:#050505;text-decoration:none;font-weight:800">Ouvrir mon lien ambassadeur</a></p><p style="font-size:13px;color:#666;word-break:break-all">${link}</p></div>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Envoi e-mail ambassadeur refusé (${response.status})`);
  }
  return true;
}
