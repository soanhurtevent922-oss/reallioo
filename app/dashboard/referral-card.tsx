"use client";

import { useState } from "react";

export default function ReferralCard({
  link,
  referrals,
  pendingCents,
  paidCents,
}: {
  link: string;
  referrals: number;
  pendingCents: number;
  paidCents: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
    </section>
  );
}
