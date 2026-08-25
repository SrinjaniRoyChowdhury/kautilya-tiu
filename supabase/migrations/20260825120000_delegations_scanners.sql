-- Allocated delegations, scanner password vault (staff-only), QR payload includes allocation.

alter table public.registrations
  add column if not exists allocated_slr int,
  add column if not exists allocated_portfolio text;

create table if not exists public.scanner_secrets (
  user_id uuid primary key references public.users (id) on delete cascade,
  password_plain text not null,
  updated_at timestamptz not null default now()
);

alter table public.scanner_secrets enable row level security;

drop policy if exists scanner_secrets_staff on public.scanner_secrets;
create policy scanner_secrets_staff on public.scanner_secrets
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

grant select, insert, update, delete on public.scanner_secrets to authenticated, service_role;

create or replace function public.resolve_scan_target(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_qr public.qr_tokens%rowtype;
  v_reg public.registrations%rowtype;
  v_user public.users%rowtype;
  v_comm public.committees%rowtype;
  v_secret text := btrim(coalesce(p_token, ''));
begin
  if v_secret !~ '^[0-9a-f]{32}$' then
    raise exception 'QR_NOT_FOUND';
  end if;

  select * into v_qr from public.qr_tokens where token = v_secret;
  if not found then
    raise exception 'QR_NOT_FOUND';
  end if;
  if v_qr.status = 'REVOKED' then
    raise exception 'QR_REVOKED';
  end if;

  select * into v_reg from public.registrations where id = v_qr.registration_id;
  if not found or v_reg.deleted_at is not null or v_reg.status <> 'CONFIRMED' then
    raise exception 'NOT_CONFIRMED';
  end if;

  select * into v_user from public.users where id = v_reg.user_id;
  if v_reg.committee_id is not null then
    select * into v_comm from public.committees where id = v_reg.committee_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'registration_id', v_reg.id,
    'edition_id', v_reg.edition_id,
    'full_name', v_user.full_name,
    'committee_short_name', v_comm.short_name,
    'committee_name', v_comm.name,
    'food_preference', v_reg.food_preference,
    'registration_status', v_reg.status,
    'display_code', v_qr.display_code,
    'issued_at', v_qr.issued_at,
    'allocated_slr', v_reg.allocated_slr,
    'allocated_portfolio', v_reg.allocated_portfolio
  );
end;
$$;
