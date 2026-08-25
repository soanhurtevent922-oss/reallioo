# Reallioo

## Mise à jour du 25 août 2026

- animation des images du haut accélérée ;
- libellé du bandeau simplifié en « RÉACTIONS DE LA COMMUNAUTÉ » ;
- vitesse du bandeau des réactions conservée.
- exemple avant/après remplacé par la Suzuki grise et la Porsche GT3 RS verte.
- le bouton « GÉNÉRER MA PHOTO » de la démo redirige vers les tarifs lorsque la photo et la demande sont renseignées.
- le titre principal devient « Donne vie à ce qui n’existe pas encore. ».
- une notification fixe apparaît en bas à gauche et change toutes les 10 secondes ;
- elle affiche des informations réelles sur Reallioo et peut signaler anonymement une vraie souscription Stripe récente.
- la mention « IA propulsée par OpenAI » apparaît près du générateur et dans les notifications, sans présenter OpenAI comme garant de la sécurité du site.
- Vercel Web Analytics est chargé sur toutes les pages via le script officiel `/_vercel/insights/script.js`.

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

Exécuter également `supabase/purchase-activity.sql` une fois dans le SQL Editor Supabase pour activer les notifications de souscriptions réelles.

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
