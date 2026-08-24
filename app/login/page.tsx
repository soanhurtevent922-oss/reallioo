"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage("Adresse e-mail ou mot de passe incorrect.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <Link className="auth-logo" href="/">REALLI<span>OO</span></Link>
      <form className="auth-card" onSubmit={signIn}>
        <p>ESPACE CRÉATEUR</p>
        <h1>Content de<br />te revoir.</h1>
        <label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@email.com" /></label>
        <label>Mot de passe<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
        {message && <div className="auth-message" role="alert">{message}</div>}
        <button className="yellow-pill" disabled={loading}>{loading ? "Connexion…" : "Se connecter →"}</button>
        <span>Pas encore de compte ? <Link href="/register">Créer mon compte</Link></span>
      </form>
    </main>
  );
}
