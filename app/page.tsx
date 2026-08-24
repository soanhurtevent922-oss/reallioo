"use client";

import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";

const prompts = [
  "Remplace ma voiture par une sportive rouge",
  "Ajoute-moi à Dubaï la nuit",
  "Transforme ma chambre en suite de luxe",
  "Ajoute une amie adulte à côté de moi",
  "Change ma tenue en look streetwear",
];

const plans = [
  { name: "DÉCOUVERTE", price: "9,99 €", credits: "10 créations / semaine", details: ["Résultats HD", "1 image de référence", "Tous les univers"] },
  { name: "CRÉATEUR", price: "19,99 €", credits: "40 créations / semaine", details: ["Tout Découverte", "Génération prioritaire", "Variantes illimitées"], featured: true },
  { name: "ULTRA", price: "39,99 €", credits: "120 créations / semaine", details: ["Tout Créateur", "Exports 4K", "Créations par lot"] },
];

const faq = [
  ["Comment fonctionne la génération ?", "Ajoute ta photo, écris ce que tu veux modifier et, si tu le souhaites, ajoute une image de référence. L’IA reconstruit la scène en respectant l’angle, la lumière et la perspective."],
  ["Puis-je montrer la voiture exacte que je veux ?", "Oui. La deuxième image sert de référence visuelle : modèle de voiture, tenue, décor ou style. Elle guide précisément la transformation."],
  ["Puis-je ajouter une personne à ma photo ?", "Oui, pour créer une scène fictive avec des adultes et dans le respect des personnes. Les usages trompeurs, non consentis ou impliquant des mineurs seront bloqués."],
  ["Combien de temps prend une création ?", "L’objectif est de produire une première version en quelques instants, puis de te laisser demander des variantes."],
  ["Mes créations sont-elles privées ?", "Tes images ne sont utilisées que pour générer ton résultat et restent accessibles depuis ton espace personnel."],
  ["Puis-je arrêter mon abonnement ?", "Oui. Toutes les formules sont sans engagement et peuvent être arrêtées depuis ton compte."],
];

export default function Home() {
  const sourceInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [reference, setReference] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [comparePosition, setComparePosition] = useState(50);

  function loadImage(event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    setter(URL.createObjectURL(file));
    setNotice("");
  }

  function previewGeneration() {
    if (!source) {
      sourceInput.current?.click();
      return;
    }
    if (!prompt.trim()) {
      setNotice("Écris d’abord ce que tu veux voir apparaître.");
      return;
    }
    setNotice("Ta demande est prête. Le moteur IA et l’espace membre arrivent à la prochaine étape.");
  }

  return (
    <main id="top">
      <nav className="pill-nav" aria-label="Navigation principale">
        <a className="logo" href="#top">REALLI<span>OO</span></a>
        <div className="nav-center"><a href="#examples">Exemples</a><a href="#how">Comment ça marche</a><a href="#prices">Tarifs</a></div>
        <div className="nav-right"><a className="signin" href="/login">Connexion</a><a className="yellow-pill compact" href="/register">Créer maintenant</a></div>
      </nav>

      <section className="viral-hero">
        <div className="moving-wall wall-one" />
        <div className="moving-wall wall-two" />
        <div className="hero-overlay" />
        <div className="version-pill"><i /> LA CRÉATION IA NOUVELLE GÉNÉRATION</div>
        <div className="hero-title"><span>IMAGINE.</span><strong>ÉCRIS.</strong><span>ÇA DEVIENT</span><strong>RÉEL.</strong></div>
        <p className="hero-sub">Change une voiture, un décor, une tenue ou toute une scène. Ajoute une image de référence et crée une photo impossible à distinguer du réel.</p>
        <a className="yellow-pill hero-button" href="#generator">Créer ma photo <b>→</b></a>
        <div className="micro-proof"><span>✦ PHOTO ORIGINALE</span><span>＋</span><span>✦ IMAGE DE RÉFÉRENCE</span><span>＋</span><span>✦ TON IDÉE</span></div>
      </section>

      <section className="marquee" aria-hidden="true"><div>CHANGE LA VOITURE ✦ AJOUTE QUELQU’UN ✦ PARS N’IMPORTE OÙ ✦ CRÉE L’IMPOSSIBLE ✦ CHANGE LA VOITURE ✦ AJOUTE QUELQU’UN ✦</div></section>

      <section className="generator-section" id="generator">
        <header className="center-heading"><p>TON IDÉE, TA PHOTO, TON RÉSULTAT</p><h2>DIS À L’IA CE QUE<br />TU VEUX <em>VOIR.</em></h2><span>Pas besoin de savoir écrire un prompt compliqué.</span></header>
        <div className="generator-shell">
          <div className="upload-column">
            <button className={`upload-card ${source ? "filled" : ""}`} type="button" onClick={() => sourceInput.current?.click()}>
              {source ? <img src={source} alt="Photo originale choisie" /> : <><b>01</b><i>＋</i><strong>Ta photo originale</strong><small>Selfie, voiture, chambre, tenue…</small></>}
            </button>
            <input ref={sourceInput} hidden type="file" accept="image/*" onChange={(event) => loadImage(event, setSource)} />
            <button className={`upload-card reference-card ${reference ? "filled" : ""}`} type="button" onClick={() => referenceInput.current?.click()}>
              {reference ? <img src={reference} alt="Image de référence choisie" /> : <><b>02 · OPTIONNEL</b><i>＋</i><strong>L’image de référence</strong><small>Montre la Porsche, la tenue ou le décor exact</small></>}
            </button>
            <input ref={referenceInput} hidden type="file" accept="image/*" onChange={(event) => loadImage(event, setReference)} />
          </div>
          <div className="prompt-card">
            <div><b>03</b><span>TA DEMANDE</span></div>
            <h3>Qu’est-ce qu’on transforme ?</h3>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Exemple : remplace la voiture derrière moi par la sportive de ma deuxième photo, garde exactement mon visage et la lumière de la scène…" />
            <div className="prompt-chips">{prompts.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
            <button className="yellow-pill generate-button" type="button" onClick={previewGeneration}>GÉNÉRER MA PHOTO <span>↗</span></button>
            {notice && <p className="generator-notice" role="status">{notice}</p>}
          </div>
        </div>
      </section>

      <section className="examples-section" id="examples">
        <div className="split-heading"><h2>VOIS LA<br />DIFFÉRENCE.</h2><p>Une transformation spectaculaire, mais cohérente avec ta photo : même angle, mêmes ombres, même ambiance.</p></div>
        <div className="before-after" style={{ "--position": `${comparePosition}%` } as CSSProperties}>
          <img className="compare-image compare-before" src="/reallioo-voiture-originale.webp" alt="Photo originale d’une voiture blanche" />
          <div className="compare-after-wrap">
            <img className="compare-image compare-after" src="/reallioo-porsche.webp" alt="Transformation en Porsche sportive réalisée avec Reallioo" />
          </div>
          <div className="compare-label before-label"><b>AVANT</b><span>Voiture blanche originale</span></div>
          <div className="compare-label after-label"><b>APRÈS</b><span>Porsche GT3 RS</span></div>
          <div className="compare-line" aria-hidden="true" />
          <div className="compare-handle" aria-hidden="true">↔</div>
          <input
            className="compare-range"
            type="range"
            min="0"
            max="100"
            value={comparePosition}
            onChange={(event) => setComparePosition(Number(event.target.value))}
            aria-label="Faire glisser pour comparer la voiture avant et après"
          />
        </div>
        <p className="compare-help">← Fais glisser pour révéler la transformation →</p>
        <a className="outline-pill" href="#generator">Tester avec ma photo <span>→</span></a>
      </section>

      <section className="possibilities">
        <p>TOUT CE QUE TU PEUX IMAGINER</p>
        <h2>UN CLIC.<br /><em>UNE AUTRE RÉALITÉ.</em></h2>
        <div className="possibility-grid">
          <article><b>01</b><h3>CHANGE TA VOITURE</h3><p>Ajoute le modèle exact en référence et transforme la scène sans changer le décor.</p><span>→</span></article>
          <article><b>02</b><h3>AJOUTE UNE PERSONNE</h3><p>Compose une scène crédible avec des adultes, une posture naturelle et une lumière cohérente.</p><span>→</span></article>
          <article><b>03</b><h3>CHANGE DE DÉCOR</h3><p>Plage privée, rooftop, montagne ou ville de nuit : pars où tu veux sans bouger.</p><span>→</span></article>
          <article><b>04</b><h3>INVENTE TON LOOK</h3><p>Essaie une tenue, une coiffure ou une ambiance avant même de la posséder.</p><span>→</span></article>
        </div>
      </section>

      <section className="how-section" id="how">
        <header><p>AUSSI SIMPLE QU’UN TIKTOK</p><h2>3 ÉTAPES.<br /><em>ZÉRO PRISE DE TÊTE.</em></h2></header>
        <div className="how-list">
          <article><strong>1</strong><div><h3>AJOUTE TA PHOTO</h3><p>Celle que tu veux transformer.</p></div><span>↗</span></article>
          <article><strong>2</strong><div><h3>MONTRE OU DÉCRIS</h3><p>Ajoute une référence ou écris ton idée.</p></div><span>↗</span></article>
          <article><strong>3</strong><div><h3>CRÉE ET PARTAGE</h3><p>Compare, télécharge et poste ta meilleure version.</p></div><span>↗</span></article>
        </div>
      </section>

      <section className="pricing-section" id="prices">
        <header className="center-heading"><p>CHOISIS TON NIVEAU</p><h2>PLUS D’IDÉES.<br /><em>PLUS DE CRÉATIONS.</em></h2><span>Sans engagement. Tes crédits reviennent chaque semaine.</span></header>
        <div className="plan-grid">
          {plans.map((plan) => <article className={plan.featured ? "plan featured" : "plan"} key={plan.name}>
            {plan.featured && <div className="popular">LE PLUS CHOISI</div>}
            <p>{plan.name}</p><h3>{plan.price}<small>/mois</small></h3><strong>{plan.credits}</strong>
            <ul>{plan.details.map((detail) => <li key={detail}>✓ {detail}</li>)}</ul>
            <a className={plan.featured ? "yellow-pill" : "outline-pill"} href="/register">Commencer <span>→</span></a>
          </article>)}
        </div>
      </section>

      <section className="faq-section">
        <header><h2>QUESTIONS<br /><em>FRÉQUENTES.</em></h2><p>Ce que tu dois savoir avant ta première création.</p></header>
        <div className="faq-list">{faq.map(([question, answer], index) => <button type="button" className="faq-item" key={question} onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span><b>{openFaq === index ? "−" : "⌄"}</b>{openFaq === index && <p>{answer}</p>}</button>)}</div>
      </section>

      <section className="final-cta"><p>TA PROCHAINE PHOTO VA FAIRE PARLER.</p><h2>CRÉE CE QUE<br />LES AUTRES<br /><em>N’OSENT PAS.</em></h2><a className="yellow-pill" href="#generator">Démarrer maintenant <span>→</span></a></section>
      <footer><a className="logo" href="#top">REALLI<span>OO</span></a><div><a href="#examples">Exemples</a><a href="#prices">Tarifs</a><a href="#top">Confidentialité</a><a href="#top">CGU</a></div><p>Création d’images IA réalistes et responsables.</p><small>© 2026 Reallioo — Tous droits réservés.</small></footer>
      <a className="floating-create" href="#generator" aria-label="Créer une photo">✦<span>CRÉER</span></a>
    </main>
  );
}
