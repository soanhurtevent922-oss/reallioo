create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',
  is_admin boolean not null default false,
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  credits_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null,
  reference_path text,
  prompt text not null,
  result_path text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.subscriptions enable row level security;

create table if not exists public.stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_events enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;

create policy "Users read own generations" on public.generations
  for select using (auth.uid() = user_id);
create policy "Users create own generations" on public.generations
  for insert with check (auth.uid() = user_id);

create policy "Users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
