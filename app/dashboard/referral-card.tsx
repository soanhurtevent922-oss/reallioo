"use client";

import { FormEvent, useState } from "react";

type BankDetailsSummary = {
  configured: boolean;
  accountHolderName?: string;
  maskedIban?: string;
};

export default function ReferralCard({
  link,
  referrals,
  pendingCents,
  paidCents,
  bankDetails: initialBankDetails,
}: {
  link: string;
  referrals: number;
  pendingCents: number;
  paidCents: number;
  bankDetails: BankDetailsSummary;
}) {
  const [copied, setCopied] = useState(false);
  const [bankDetails, setBankDetails] = useState(initialBankDetails);
  const [editingBank, setEditingBank] = useState(!initialBankDetails.configured);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankMessage, setBankMessage] = useState("");

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function saveBankDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBankLoading(true);
    setBankMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: form.get("accountHolderName"),
          iban: form.get("iban"),
          bic: form.get("bic"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d’enregistrer le RIB.");

      setBankDetails({
        configured: true,
        accountHolderName: result.accountHolderName,
        maskedIban: result.maskedIban,
      });
      setEditingBank(false);
      setBankMessage("RIB enregistré et chiffré ✓");
    } catch (error) {
      setBankMessage(error instanceof Error ? error.message : "Impossible d’enregistrer le RIB.");
    } finally {
      setBankLoading(false);
    }
  }

  async function deleteBankDetails() {
    if (!window.confirm("Supprimer tes coordonnées bancaires enregistrées ?")) return;
    setBankLoading(true);
    setBankMessage("");
    try {
      const response = await fetch("/api/payout-details", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de supprimer le RIB.");
      setBankDetails({ configured: false });
      setEditingBank(true);
      setBankMessage("Tes coordonnées bancaires ont été supprimées.");
    } catch (error) {
      setBankMessage(error instanceof Error ? error.message : "Impossible de supprimer le RIB.");
    } finally {
      setBankLoading(false);
    }
  }

  const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <section className="referral-dashboard" id="ambassador">
      <div className="referral-dashboard-heading">
        <div><p>40 % STARTER · 50 % CRÉATEUR ET À VIE</p><h2>Ton lien personnel.</h2></div>
        <span>{referrals} CLIENT{referrals > 1 ? "S" : ""} APPORTÉ{referrals > 1 ? "S" : ""}</span>
      </div>
      <div className="referral-link-row">
        <input value={link} readOnly aria-label="Lien ambassadeur personnel" />
        <button className="yellow-pill" type="button" onClick={copyLink}>{copied ? "Lien copié ✓" : "Copier mon lien"}</button>
      </div>
      <div className="referral-stats">
        <div><small>COMMISSIONS EN ATTENTE</small><strong>{euro.format(pendingCents / 100)}</strong></div>
        <div><small>COMMISSIONS VERSÉES</small><strong>{euro.format(paidCents / 100)}</strong></div>
        <p>Tu gagnes 40 % de chaque mensualité Starter et 50 % de chaque mensualité Créateur tant que l’abonnement apporté reste actif. L’accès à vie génère une commission unique de 50 %.</p>
      </div>

      <div className="payout-bank-card">
        <div className="payout-bank-heading">
          <div><small>COORDONNÉES DE VERSEMENT</small><h3>Reçois tes commissions.</h3></div>
          <span>{bankDetails.configured ? "RIB ENREGISTRÉ ✓" : "À CONFIGURER"}</span>
        </div>
        <p className="payout-bank-explainer">Ton IBAN est chiffré et utilisé uniquement par Reallioo pour te verser tes commissions. Il n’est jamais affiché publiquement et Reallioo n’effectue aucun prélèvement sur ton compte.</p>

        {bankDetails.configured && !editingBank ? (
          <div className="payout-bank-saved">
            <div><small>TITULAIRE</small><strong>{bankDetails.accountHolderName}</strong></div>
            <div><small>IBAN PROTÉGÉ</small><strong>{bankDetails.maskedIban}</strong></div>
            <div className="payout-bank-actions">
              <button type="button" onClick={() => { setEditingBank(true); setBankMessage(""); }}>Modifier</button>
              <button type="button" onClick={deleteBankDetails} disabled={bankLoading}>Supprimer</button>
            </div>
          </div>
        ) : (
          <form className="payout-bank-form" onSubmit={saveBankDetails}>
            <label>Nom complet du titulaire<input name="accountHolderName" required minLength={2} maxLength={120} autoComplete="name" defaultValue={bankDetails.accountHolderName || ""} placeholder="Prénom NOM" /></label>
            <label>IBAN<input name="iban" required minLength={15} maxLength={42} autoComplete="off" spellCheck={false} placeholder="FR76 0000 0000 0000 0000 0000 000" /></label>
            <label>BIC <small>(facultatif)</small><input name="bic" maxLength={11} autoComplete="off" spellCheck={false} placeholder="AGRIFRPPXXX" /></label>
            <div className="payout-bank-form-actions">
              {bankDetails.configured && <button type="button" onClick={() => setEditingBank(false)}>Annuler</button>}
              <button className="yellow-pill" disabled={bankLoading}>{bankLoading ? "Enregistrement…" : "Enregistrer mon RIB"}</button>
            </div>
          </form>
        )}
        {bankMessage && <p className="payout-bank-message" role="status">{bankMessage}</p>}
      </div>
    </section>
  );
}
