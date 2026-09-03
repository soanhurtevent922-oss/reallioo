-- Coordonnées bancaires des ambassadeurs.
-- Les IBAN et BIC sont chiffrés côté serveur avant leur arrivée dans Supabase.
-- Aucune règle RLS publique n'est créée : seul le serveur Reallioo (service role) y accède.

create table if not exists public.payout_bank_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_holder_name text not null check (char_length(account_holder_name) between 2 and 120),
  iban_ciphertext text not null,
  iban_iv text not null,
  iban_tag text not null,
  iban_country text not null check (iban_country ~ '^[A-Z]{2}$'),
  iban_last4 text not null check (iban_last4 ~ '^[A-Z0-9]{4}$'),
  bic_ciphertext text,
  bic_iv text,
  bic_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (bic_ciphertext is null and bic_iv is null and bic_tag is null)
    or
    (bic_ciphertext is not null and bic_iv is not null and bic_tag is not null)
  )
);

alter table public.payout_bank_details enable row level security;
revoke all privileges on table public.payout_bank_details from anon, authenticated;
grant all privileges on table public.payout_bank_details to service_role;
