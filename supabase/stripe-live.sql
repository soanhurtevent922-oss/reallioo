-- À exécuter UNE FOIS dans Supabase > SQL Editor pour activer Stripe en production.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.subscriptions
  add column if not exists stripe_price_id text;

create table if not exists public.stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_events enable row level security;

-- Important : seul le serveur Stripe peut modifier les offres et les crédits.
drop policy if exists "Users update own profile" on public.profiles;

-- Accès propriétaire gratuit et illimité réservé à ton compte.
update public.profiles
set is_admin = true,
    plan = 'admin',
    credits_remaining = 999999,
    credits_reset_at = null,
    updated_at = now()
where lower(email) = 'soanhurtevent922@icloud.com';
