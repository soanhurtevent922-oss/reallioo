"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "invalid") {
      setMessage("Ce lien a expiré ou n’est plus valide. Demande un nouveau lien.");
    }
  }, []);

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    setLoading(false);
    if (error) {
      setMessage("Impossible d’envoyer le lien pour le moment. Réessaie dans quelques minutes.");
      return;
    }

    setSent(true);
    setMessage("Lien envoyé ! Vérifie ta boîte e-mail et tes courriers indésirables.");
  }

  return (
    <main className="auth-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <form className="auth-card" onSubmit={sendResetLink}>
        <p>RÉCUPÉRATION DU COMPTE</p>
        <h1>Mot de passe<br />oublié ?</h1>
        <label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@email.com" disabled={sent} /></label>
        {message && <div className="auth-message" role="status">{message}</div>}
        {!sent && <button className="yellow-pill" disabled={loading}>{loading ? "Envoi…" : "Recevoir le lien →"}</button>}
        <span><Link href="/login">← Retour à la connexion</Link></span>
      </form>
    </main>
  );
}
