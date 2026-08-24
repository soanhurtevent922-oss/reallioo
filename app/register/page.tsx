"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    setMessage(error ? error.message : "Compte créé ! Vérifie maintenant ta boîte e-mail.");
  }

  return (
    <main className="auth-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <form className="auth-card" onSubmit={signUp}>
        <p>PREMIÈRE CRÉATION</p>
        <h1>Crée ton<br />compte.</h1>
        <label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@email.com" /></label>
        <label>Mot de passe<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" /></label>
        {message && <div className="auth-message" role="status">{message}</div>}
        <button className="yellow-pill" disabled={loading}>{loading ? "Création…" : "Créer mon compte →"}</button>
        <span>Déjà inscrit ? <Link href="/login">Se connecter</Link></span>
      </form>
    </main>
  );
}
