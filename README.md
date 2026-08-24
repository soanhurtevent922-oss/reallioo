# Reallioo

SaaS B2C de création et de transformation d'images par IA.

## Stack

- Next.js 16
- Supabase (comptes, base de données et stockage)
- Stripe (abonnements et crédits, prochaine étape)
- Vercel (hébergement)

## Variables à configurer

Copier `.env.example` vers `.env.local`, puis renseigner :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Développement

```bash
npm install
npm run dev
```

## Vérification avant déploiement

```bash
npm run build
```
