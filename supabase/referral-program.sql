create table if not exists public.referral_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8,20}$'),
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('starter', 'creator', 'lifetime')),
  created_at timestamptz not null default now(),
  check (referred_user_id <> referrer_user_id)
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_id text not null unique,
  plan text not null check (plan in ('starter', 'creator', 'lifetime')),
  payment_kind text not null check (payment_kind in ('subscription', 'lifetime')),
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  commission_cents integer not null check (commission_cents >= 0),
  commission_percent integer not null default 40 check (commission_percent in (20, 40, 50)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.referral_commissions
  drop constraint if exists referral_commissions_commission_percent_check;
alter table public.referral_commissions
  add constraint referral_commissions_commission_percent_check
  check (commission_percent in (20, 40, 50));
alter table public.referral_commissions
  alter column commission_percent set default 40;

create index if not exists referral_attributions_referrer_idx
  on public.referral_attributions (referrer_user_id, created_at desc);
create index if not exists referral_commissions_referrer_idx
  on public.referral_commissions (referrer_user_id, created_at desc);

alter table public.referral_accounts enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_commissions enable row level security;

drop policy if exists "Users read own referral account" on public.referral_accounts;
create policy "Users read own referral account" on public.referral_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "Users read own referral commissions" on public.referral_commissions;
create policy "Users read own referral commissions" on public.referral_commissions
  for select using (auth.uid() = referrer_user_id);
