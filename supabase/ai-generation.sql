-- À exécuter une seule fois dans le SQL Editor Supabase de Reallioo.
-- Ce script crée le stockage privé et verrouille le débit des crédits côté serveur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generations',
  'generations',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.consume_generation_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_credits integer;
begin
  select is_admin, credits_remaining
  into v_is_admin, v_credits
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_is_admin then
    return -1;
  end if;

  if v_credits < 1 then
    raise exception 'insufficient_credits';
  end if;

  update public.profiles
  set credits_remaining = credits_remaining - 1,
      updated_at = now()
  where id = p_user_id
  returning credits_remaining into v_credits;

  return v_credits;
end;
$$;

create or replace function public.refund_generation_credit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits_remaining = credits_remaining + 1,
      updated_at = now()
  where id = p_user_id
    and is_admin = false;
end;
$$;

revoke all on function public.consume_generation_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_generation_credit(uuid) from public, anon, authenticated;
grant execute on function public.consume_generation_credit(uuid) to service_role;
grant execute on function public.refund_generation_credit(uuid) to service_role;
