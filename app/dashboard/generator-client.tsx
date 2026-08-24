"use client";

import { useEffect, useRef, useState } from "react";

export type GenerationCard = {
  id: string;
  prompt: string;
  resultUrl: string;
  createdAt: string;
};

type Props = {
  initialCredits: number | null;
  initialGenerations: GenerationCard[];
};

const MAX_UPLOAD_BYTES = 2_050_000;

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareImage(file: File, preserveReference = false) {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n’est pas une image.");

  // Never recompress a reference that already fits the upload limit. Fine
  // product details (logos, dial markings, engravings) must reach the API with
  // exactly the pixels supplied by the user.
  if (
    preserveReference
    && ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    && file.size <= MAX_UPLOAD_BYTES
  ) {
    return file;
  }

  const image = await loadImage(file);
  const maxEdge = preserveReference ? 2560 : 2048;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: preserveReference });
  if (!context) throw new Error("Impossible de préparer cette image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const outputType = preserveReference ? "image/webp" : "image/jpeg";
  let quality = preserveReference ? 0.98 : 0.94;
  let blob: Blob | null = null;
  do {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
    quality -= preserveReference ? 0.03 : 0.05;
  } while (blob && blob.size > MAX_UPLOAD_BYTES && quality >= (preserveReference ? 0.79 : 0.7));
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("Cette photo est trop lourde. Choisis une autre photo.");

  const extension = preserveReference ? "webp" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${extension}`, { type: outputType });
}

function UploadCard({ title, subtitle, file, onChange, optional = false }: {
  title: string;
  subtitle: string;
  file: File | null;
  onChange: (file: File | null) => void;
  optional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={`dashboard-upload-card ${file ? "has-image" : ""}`}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onChange(event.target.files?.[0] || null)} />
      {preview ? <img src={preview} alt="Aperçu de la photo" /> : null}
      <button type="button" onClick={() => inputRef.current?.click()}>
        <strong>{file ? "↻" : "+"}</strong>
        <span>{file ? "Changer la photo" : title}</span>
        <small>{file ? file.name : subtitle}</small>
      </button>
      {optional && !file ? <em>OPTIONNEL</em> : null}
      {file ? <button className="remove-upload" type="button" onClick={() => onChange(null)} aria-label="Retirer la photo">×</button> : null}
    </div>
  );
}

export default function GeneratorClient({ initialCredits, initialGenerations }: Props) {
  const [source, setSource] = useState<File | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [generations, setGenerations] = useState(initialGenerations);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationCard | null>(initialGenerations[0] || null);

  async function generate() {
    if (!source) { setMessage("Ajoute d’abord la photo que tu veux modifier."); return; }
    if (prompt.trim().length < 6) { setMessage("Explique ce que tu veux modifier sur la photo."); return; }
    if (credits !== null && credits < 1) { setMessage("Tu n’as plus de crédits. Choisis une offre pour continuer."); return; }

    setLoading(true);
    setMessage("Préparation de tes photos…");
    try {
      const preparedSource = await prepareImage(source);
      const preparedReference = reference ? await prepareImage(reference, true) : null;
      const form = new FormData();
      form.append("source", preparedSource);
      if (preparedReference) form.append("reference", preparedReference);
      form.append("prompt", prompt.trim());

      setMessage("L’IA construit ton image réaliste en format vertical mobile. Cela peut prendre jusqu’à deux minutes…");
      const response = await fetch("/api/generate", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "La génération a échoué.");

      const generated = payload.generation as GenerationCard;
      setResult(generated);
      setGenerations((current) => [generated, ...current.filter((item) => item.id !== generated.id)]);
      if (payload.creditsRemaining !== null) setCredits(Number(payload.creditsRemaining));
      setMessage("Ta photo est prête. Tu peux la télécharger en qualité mobile.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La génération a échoué. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="dashboard-studio">
        <div className="dashboard-upload-grid">
          <UploadCard title="Ajoute ta photo" subtitle="La scène d’origine à conserver" file={source} onChange={setSource} />
          <UploadCard title="Ajoute une référence" subtitle="Voiture, tenue, objet ou personne adulte" file={reference} onChange={setReference} optional />
        </div>

        <div className="dashboard-prompt">
          <div className="prompt-heading"><p>CE QUE TU VEUX MODIFIER</p><span>FORMAT MOBILE · PORTRAIT</span></div>
          <textarea value={prompt} maxLength={1500} onChange={(event) => setPrompt(event.target.value)} placeholder="Exemple : remplace la voiture blanche par exactement la Porsche de la photo de référence. Garde le décor, l’angle, la porte ouverte et la lumière identiques." />
          <div className="prompt-footer">
            <small>{prompt.length}/1500</small>
            <button className="yellow-pill" type="button" disabled={loading} onClick={generate}>{loading ? "CRÉATION EN COURS…" : "GÉNÉRER MA PHOTO →"}</button>
          </div>
          {message ? <div className={`generation-message ${loading ? "loading" : ""}`}>{loading ? <i /> : null}{message}</div> : null}
        </div>
      </section>

      {result ? (
        <section className="generation-result">
          <div><p>DERNIÈRE CRÉATION</p><h2>Ton image est prête.</h2><span>1024 × 1536 · WebP · optimisée pour mobile et réseaux sociaux</span><a className="yellow-pill" href={`/api/generations/${result.id}/download`}>Télécharger l’image ↓</a></div>
          <img src={result.resultUrl} alt={result.prompt} />
        </section>
      ) : null}

      <section className="generation-history" id="history">
        <div className="history-heading"><div><p>TES CRÉATIONS</p><h2>{generations.length ? "Ton studio personnel." : "Tes prochaines images apparaîtront ici."}</h2></div><span>{credits === null ? "ACCÈS ILLIMITÉ" : `${credits} CRÉDIT${credits > 1 ? "S" : ""} RESTANT${credits > 1 ? "S" : ""}`}</span></div>
        {generations.length ? (
          <div className="history-grid">{generations.map((generation) => <article key={generation.id}><button type="button" onClick={() => setResult(generation)}><img src={generation.resultUrl} alt={generation.prompt} /></button><div><p>{generation.prompt}</p><a href={`/api/generations/${generation.id}/download`}>Télécharger ↓</a></div></article>)}</div>
        ) : <span>Ta première génération terminée sera conservée ici.</span>}
      </section>
    </>
  );
}
