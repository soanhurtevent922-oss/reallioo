# Reallioo

## Mise à jour du 25 août 2026

- animation des images du haut accélérée ;
- libellé du bandeau simplifié en « RÉACTIONS DE LA COMMUNAUTÉ » ;
- vitesse du bandeau des réactions conservée.

SaaS B2C de création et de transformation d'images par IA.

## Stack

- Next.js 16
- Supabase (comptes, base de données et stockage)
- Stripe (abonnements et crédits)
- OpenAI GPT Image (retouche photoréaliste)
- Vercel (hébergement)

## Variables à configurer

Copier `.env.example` vers `.env.local`, puis renseigner :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Exécuter aussi `supabase/ai-generation.sql` une fois dans le SQL Editor Supabase.

Le moteur produit des images WebP en `1152 × 2048` (9:16), qualité `medium`, à partir d’une photo principale et d’une référence facultative.

## Développement

```bash
npm install
npm run dev
```

## Vérification avant déploiement

```bash
npm run build
```
