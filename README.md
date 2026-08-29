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
- nouveaux tarifs : Starter à 19,99 €/mois, Créateur à 34,99 €/mois et accès à vie à 250 € ;
- promotion Starter à 10,99 €/mois jusqu’au 15 septembre 2026 à 23 h 59 (heure de Paris) ; les abonnés entrés pendant l’offre conservent ce tarif tant que leur abonnement reste actif ;
- programme ambassadeur avec un lien personnel par client payant ;
- commission de 40 % enregistrée à chaque mensualité Starter pendant toute la durée de l’abonnement apporté ;
- commission de 50 % enregistrée à chaque mensualité Créateur pendant toute la durée de l’abonnement apporté ;
- commission unique de 50 % quand le client apporté choisit l’accès à vie ;
- le lien et les commissions apparaissent dans le tableau de bord ;
- le lien peut aussi être envoyé par e-mail avec Resend.

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
RESEND_API_KEY=
RESEND_FROM_EMAIL=Reallioo <ambassadeur@votre-domaine.com>
```

Exécuter aussi `supabase/ai-generation.sql` une fois dans le SQL Editor Supabase.

Exécuter également `supabase/purchase-activity.sql` une fois dans le SQL Editor Supabase pour activer les notifications de souscriptions réelles.

Exécuter `supabase/referral-program.sql` une fois dans le SQL Editor Supabase pour créer les liens ambassadeurs, conserver l’attribution des clients et enregistrer les commissions.

Les nouveaux paiements Stripe utilisent directement les tarifs définis dans `lib/plans.ts`. Les anciennes variables `STRIPE_PRICE_*` ne sont donc plus nécessaires.

Les commissions sont enregistrées avec le statut `pending`. Leur versement reste manuel tant qu’un système de paiement aux ambassadeurs, par exemple Stripe Connect, n’a pas été configuré. Après un paiement manuel, passer la commission concernée au statut `paid` et renseigner `paid_at` dans Supabase.

## E-mail de réinitialisation du mot de passe

Dans Supabase, ouvrir `Authentication → Emails → Templates → Reset password`, puis remplacer le contenu du modèle par celui de `supabase/reset-password-email-template.html`. Le jeton est placé après `#` pour empêcher les outils de prévisualisation des messageries de le consommer avant le clic réel de l’utilisateur.

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
