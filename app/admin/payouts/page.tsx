import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptBankValue, maskedIban } from "@/lib/payout-bank";
import CopyBankButton from "./copy-bank-button";

export const dynamic = "force-dynamic";

type BankRow = {
  user_id: string;
  account_holder_name: string;
  iban_ciphertext: string;
  iban_iv: string;
  iban_tag: string;
  iban_country: string;
  iban_last4: string;
  bic_ciphertext: string | null;
  bic_iv: string | null;
  bic_tag: string | null;
  updated_at: string;
};

export default async function AdminPayoutsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const userId = String(data.claims.sub);
  const admin = createAdminClient();
  const { data: owner } = await admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!owner?.is_admin) redirect("/dashboard");

  const [{ data: commissions }, { data: bankDetails }] = await Promise.all([
    admin
      .from("referral_commissions")
      .select("referrer_user_id, commission_cents, status")
      .in("status", ["pending", "approved"]),
    admin
      .from("payout_bank_details")
      .select("user_id, account_holder_name, iban_ciphertext, iban_iv, iban_tag, iban_country, iban_last4, bic_ciphertext, bic_iv, bic_tag, updated_at"),
  ]);

  const pendingByUser = new Map<string, number>();
  for (const commission of commissions || []) {
    const current = pendingByUser.get(commission.referrer_user_id) || 0;
    pendingByUser.set(commission.referrer_user_id, current + Number(commission.commission_cents || 0));
  }

  const userIds = Array.from(new Set([
    ...pendingByUser.keys(),
    ...((bankDetails || []) as BankRow[]).map((row) => row.user_id),
  ]));
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] as { id: string; email: string | null }[] };
  const emails = new Map((profiles || []).map((profile) => [profile.id, profile.email || "E-mail inconnu"]));
  const banks = new Map(((bankDetails || []) as BankRow[]).map((row) => [row.user_id, row]));
  const rows = userIds
    .map((id) => ({ id, email: emails.get(id) || "E-mail inconnu", pendingCents: pendingByUser.get(id) || 0, bank: banks.get(id) }))
    .sort((a, b) => b.pendingCents - a.pendingCents);
  const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <main className="admin-payout-page">
      <header>
        <div><p>ADMINISTRATION · DONNÉES CONFIDENTIELLES</p><h1>Virements ambassadeurs.</h1></div>
        <a href="/dashboard">← Retour au dashboard</a>
      </header>
      <section className="admin-payout-summary">
        <div><small>AMBASSADEURS À SUIVRE</small><strong>{rows.length}</strong></div>
        <div><small>TOTAL EN ATTENTE</small><strong>{euro.format(rows.reduce((sum, row) => sum + row.pendingCents, 0) / 100)}</strong></div>
      </section>
      <section className="admin-payout-list">
        {rows.length === 0 ? <p className="admin-payout-empty">Aucune commission en attente et aucun RIB enregistré.</p> : rows.map((row) => {
          let iban = "";
          let bic = "";
          let decryptError = false;
          if (row.bank) {
            try {
              iban = decryptBankValue({ ciphertext: row.bank.iban_ciphertext, iv: row.bank.iban_iv, tag: row.bank.iban_tag });
              if (row.bank.bic_ciphertext && row.bank.bic_iv && row.bank.bic_tag) {
                bic = decryptBankValue({ ciphertext: row.bank.bic_ciphertext, iv: row.bank.bic_iv, tag: row.bank.bic_tag });
              }
            } catch (error) {
              decryptError = true;
              console.error("Payout bank details could not be decrypted", row.id, error);
            }
          }

          return (
            <article key={row.id}>
              <div className="admin-payout-person">
                <span>{row.pendingCents > 0 ? "VIREMENT À PRÉPARER" : "RIB ENREGISTRÉ"}</span>
                <h2>{row.bank?.account_holder_name || "Titulaire non renseigné"}</h2>
                <p>{row.email}</p>
              </div>
              <div className="admin-payout-amount"><small>EN ATTENTE</small><strong>{euro.format(row.pendingCents / 100)}</strong></div>
              {row.bank && !decryptError ? (
                <div className="admin-bank-values">
                  <div><small>IBAN</small><code>{iban}</code><CopyBankButton value={iban} label="l’IBAN" /></div>
                  <div><small>BIC</small><code>{bic || "Non renseigné"}</code>{bic && <CopyBankButton value={bic} label="le BIC" />}</div>
                  <p>Enregistré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(row.bank.updated_at))}</p>
                </div>
              ) : row.bank ? (
                <div className="admin-bank-missing">Impossible de déchiffrer {maskedIban(row.bank.iban_country, row.bank.iban_last4)}. Vérifie la clé de chiffrement.</div>
              ) : (
                <div className="admin-bank-missing">RIB manquant — aucun virement ne doit être effectué avant son ajout.</div>
              )}
            </article>
          );
        })}
      </section>
      <p className="admin-payout-warning">Ces coordonnées sont confidentielles. Utilise-les uniquement pour verser les commissions, puis marque les commissions comme payées dans Supabase.</p>
    </main>
  );
}
