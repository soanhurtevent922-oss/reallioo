"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("Vérification du lien…");
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setReady(true);
        setMessage("");
      } else {
        setMessage("Ce lien a expiré ou n’est plus valide. Demande un nouveau lien.");
      }
    });
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setMessage("Impossible de modifier le mot de passe. Demande un nouveau lien.");
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setSuccess(true);
    setReady(false);
    setPassword("");
    setConfirmation("");
    setMessage("Mot de passe modifié ! Tu peux maintenant te connecter.");
  }

  return (
    <main className="auth-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <form className="auth-card" onSubmit={updatePassword}>
        <p>NOUVEAU MOT DE PASSE</p>
        <h1>Crée ton nouveau<br />mot de passe.</h1>
        {ready && <>
          <label>Nouveau mot de passe<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></label>
          <label>Confirmer le mot de passe<input type="password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Répète ton mot de passe" /></label>
        </>}
        {message && <div className="auth-message" role="status">{message}</div>}
        {ready && <button className="yellow-pill" disabled={loading}>{loading ? "Modification…" : "Modifier mon mot de passe →"}</button>}
        {success && <span><Link href="/login">Se connecter avec mon nouveau mot de passe →</Link></span>}
        {!ready && !success && <span><Link href="/forgot-password">Recevoir un nouveau lien</Link></span>}
      </form>
    </main>
  );
}
