-- Registration phases, per-committee single/double fees, double delegation pairing,
-- edition expenses, occupancy by delegation (not person), and 2025/2026 dates.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'registration_phase_kind') then
    create type public.registration_phase_kind as enum ('EARLY_BIRD', 'PHASE_1', 'PHASE_2');
  end if;
  if not exists (select 1 from pg_type where typname = 'delegation_type') then
    create type public.delegation_type as enum ('SINGLE', 'DOUBLE');
  end if;
end $$;

create table if not exists public.registration_phases (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete cascade,
  kind public.registration_phase_kind not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, kind)
);

drop trigger if exists registration_phases_set_updated_at on public.registration_phases;
create trigger registration_phases_set_updated_at
  before update on public.registration_phases
  for each row execute function public.set_updated_at();

create unique index if not exists registration_phases_one_active
  on public.registration_phases (edition_id)
  where is_active;

create table if not exists public.committee_phase_fees (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees (id) on delete cascade,
  phase_id uuid not null references public.registration_phases (id) on delete cascade,
  single_fee_minor int not null default 0 check (single_fee_minor >= 0),
  double_fee_minor int not null default 0 check (double_fee_minor >= 0),
  unique (committee_id, phase_id)
);

create table if not exists public.edition_expenses (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete cascade,
  title text not null,
  category text,
  amount_minor int not null check (amount_minor >= 0),
  incurred_on date not null default (timezone('Asia/Kolkata', now()))::date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edition_expenses_title_len check (char_length(trim(title)) between 2 and 120)
);

drop trigger if exists edition_expenses_set_updated_at on public.edition_expenses;
create trigger edition_expenses_set_updated_at
  before update on public.edition_expenses
  for each row execute function public.set_updated_at();

alter table public.committees
  add column if not exists allows_single_del boolean not null default true,
  add column if not exists allows_double_del boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'committees_allows_one_del'
  ) then
    alter table public.committees
      add constraint committees_allows_one_del
      check (allows_single_del or allows_double_del);
  end if;
end $$;

alter table public.registrations
  add column if not exists delegation_type public.delegation_type not null default 'SINGLE',
  add column if not exists partner_email extensions.citext,
  add column if not exists partner_registration_id uuid references public.registrations (id) on delete set null,
  add column if not exists pair_id uuid,
  add column if not exists is_pair_lead boolean not null default true;

create index if not exists registrations_pair_id_idx
  on public.registrations (pair_id)
  where pair_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.ensure_edition_phases(p_edition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.registration_phases (edition_id, kind, is_active)
  values
    (p_edition_id, 'EARLY_BIRD', true),
    (p_edition_id, 'PHASE_1', false),
    (p_edition_id, 'PHASE_2', false)
  on conflict (edition_id, kind) do nothing;

  if not exists (
    select 1 from public.registration_phases
    where edition_id = p_edition_id and is_active
  ) then
    update public.registration_phases
    set is_active = true
    where edition_id = p_edition_id and kind = 'EARLY_BIRD';
  end if;
end;
$$;

create or replace function public.seed_committee_phase_fees(p_committee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition uuid;
  v_fee int;
begin
  select edition_id, fee_minor into v_edition, v_fee
  from public.committees
  where id = p_committee_id;
  if v_edition is null then
    return;
  end if;
  perform public.ensure_edition_phases(v_edition);
  insert into public.committee_phase_fees (committee_id, phase_id, single_fee_minor, double_fee_minor)
  select p_committee_id, p.id, coalesce(v_fee, 0), coalesce(v_fee, 0)
  from public.registration_phases p
  where p.edition_id = v_edition
  on conflict (committee_id, phase_id) do nothing;
end;
$$;

create or replace function public.committee_current_fee(
  p_committee_id uuid,
  p_type public.delegation_type
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_edition uuid;
  v_fallback int;
  v_amount int;
begin
  select edition_id, fee_minor into v_edition, v_fallback
  from public.committees
  where id = p_committee_id;
  if v_edition is null then
    return 0;
  end if;
  select case
    when p_type = 'DOUBLE' then f.double_fee_minor
    else f.single_fee_minor
  end
  into v_amount
  from public.registration_phases p
  join public.committee_phase_fees f
    on f.phase_id = p.id and f.committee_id = p_committee_id
  where p.edition_id = v_edition and p.is_active
  limit 1;
  return coalesce(v_amount, v_fallback, 0);
end;
$$;

create or replace function public.sync_committee_fee_minor(p_committee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.committees
  set fee_minor = public.committee_current_fee(p_committee_id, 'SINGLE')
  where id = p_committee_id;
end;
$$;

create or replace function public.activate_registration_phase(p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition uuid;
begin
  if not public.has_permission('edition.manage', null) then
    raise exception 'FORBIDDEN';
  end if;
  select edition_id into v_edition from public.registration_phases where id = p_phase_id;
  if v_edition is null then
    raise exception 'NOT_FOUND';
  end if;
  update public.registration_phases
  set is_active = (id = p_phase_id)
  where edition_id = v_edition;
  update public.committees c
  set fee_minor = public.committee_current_fee(c.id, 'SINGLE')
  where c.edition_id = v_edition and c.deleted_at is null;
end;
$$;

create or replace function public.trg_mun_editions_phases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_edition_phases(new.id);
  return new;
end;
$$;

drop trigger if exists mun_editions_ensure_phases on public.mun_editions;
create trigger mun_editions_ensure_phases
  after insert on public.mun_editions
  for each row execute function public.trg_mun_editions_phases();

create or replace function public.trg_committees_phase_fees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_committee_phase_fees(new.id);
  return new;
end;
$$;

drop trigger if exists committees_seed_phase_fees on public.committees;
create trigger committees_seed_phase_fees
  after insert on public.committees
  for each row execute function public.trg_committees_phase_fees();

create or replace function public.edition_committee_occupancy(p_edition_id uuid)
returns table (committee_id uuid, seats_taken int)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    count(distinct coalesce(r.pair_id, r.id))::int as seats_taken
  from public.committees c
  left join public.registrations r
    on r.committee_id = c.id
    and r.deleted_at is null
    and r.status not in ('DRAFT', 'CANCELLED')
  where c.edition_id = p_edition_id
    and c.deleted_at is null
  group by c.id;
$$;

create or replace function public.clear_delegation_pair(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_partner uuid;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    return;
  end if;
  v_partner := v_reg.partner_registration_id;
  update public.registrations
  set
    pair_id = null,
    partner_registration_id = null,
    partner_email = null,
    is_pair_lead = true,
    delegation_type = 'SINGLE'
  where id = v_reg.id;
  if v_partner is not null then
    update public.registrations
    set
      pair_id = null,
      partner_registration_id = null,
      partner_email = null,
      is_pair_lead = true,
      delegation_type = 'SINGLE',
      expected_fee_minor = 0,
      status = case when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status else 'DRAFT' end
    where id = v_partner
      and status not in ('CONFIRMED', 'PAYMENT_VERIFIED');
  end if;
end;
$$;

create or replace function public.apply_delegation_pair(
  p_registration_id uuid,
  p_committee_id uuid,
  p_delegation_type public.delegation_type,
  p_partner_email text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_email extensions.citext;
  v_self extensions.citext;
  v_partner public.users%rowtype;
  v_partner_reg public.registrations%rowtype;
  v_pair uuid;
  v_has_partner boolean := false;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_committee from public.committees where id = p_committee_id;

  if p_delegation_type = 'DOUBLE' and not v_committee.allows_double_del then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;
  if p_delegation_type = 'SINGLE' and not v_committee.allows_single_del then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;

  if p_delegation_type = 'SINGLE' then
    perform public.clear_delegation_pair(v_reg.id);
    update public.registrations
    set
      delegation_type = 'SINGLE',
      is_pair_lead = true,
      expected_fee_minor = public.committee_current_fee(p_committee_id, 'SINGLE')
    where id = v_reg.id;
    return;
  end if;

  v_email := public.normalize_email(p_partner_email);
  if v_email is null then
    raise exception 'PARTNER_REQUIRED';
  end if;
  select email into v_self from public.users where id = v_reg.user_id;
  if v_email = v_self then
    raise exception 'PARTNER_SELF';
  end if;

  select * into v_partner
  from public.users
  where email = v_email and deleted_at is null and status = 'ACTIVE';
  if not found then
    raise exception 'PARTNER_NOT_SIGNED_UP';
  end if;

  select * into v_partner_reg
  from public.registrations
  where user_id = v_partner.id
    and edition_id = v_reg.edition_id
    and deleted_at is null
    and status <> 'CANCELLED'
  for update;
  v_has_partner := found;

  if v_has_partner then
    if v_partner_reg.id = v_reg.id then
      raise exception 'PARTNER_SELF';
    end if;
    if v_partner_reg.status in ('CONFIRMED', 'PAYMENT_VERIFIED') then
      raise exception 'PARTNER_BUSY';
    end if;
    if v_partner_reg.pair_id is not null
       and v_partner_reg.partner_registration_id is distinct from v_reg.id
       and v_partner_reg.id is distinct from v_reg.partner_registration_id then
      raise exception 'PARTNER_ALREADY_PAIRED';
    end if;
    if v_partner_reg.committee_id is not null
       and v_partner_reg.committee_id is distinct from p_committee_id
       and v_partner_reg.status not in ('DRAFT') then
      raise exception 'PARTNER_BUSY';
    end if;
  end if;

  if v_reg.pair_id is not null
     and v_reg.partner_registration_id is not null
     and (
       not v_has_partner
       or v_reg.partner_registration_id is distinct from v_partner_reg.id
     ) then
    perform public.clear_delegation_pair(v_reg.id);
    select * into v_reg from public.registrations where id = p_registration_id;
  end if;

  v_pair := coalesce(v_reg.pair_id, gen_random_uuid());

  if not v_has_partner then
    insert into public.registrations (
      edition_id, user_id, committee_id, status, delegation_type,
      expected_fee_minor, pair_id, is_pair_lead, partner_email, partner_registration_id
    ) values (
      v_reg.edition_id, v_partner.id, p_committee_id, 'PAYMENT_PENDING', 'DOUBLE',
      0, v_pair, false, v_self, v_reg.id
    )
    returning * into v_partner_reg;
  else
    update public.registrations
    set
      committee_id = p_committee_id,
      status = case when status = 'DRAFT' then 'PAYMENT_PENDING' else status end,
      delegation_type = 'DOUBLE',
      expected_fee_minor = 0,
      pair_id = v_pair,
      is_pair_lead = false,
      partner_email = v_self,
      partner_registration_id = v_reg.id
    where id = v_partner_reg.id
    returning * into v_partner_reg;
  end if;

  update public.registrations
  set
    delegation_type = 'DOUBLE',
    pair_id = v_pair,
    is_pair_lead = true,
    partner_email = v_email,
    partner_registration_id = v_partner_reg.id,
    expected_fee_minor = public.committee_current_fee(p_committee_id, 'DOUBLE')
  where id = v_reg.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registration RPCs (replace signatures)
-- ---------------------------------------------------------------------------

drop function if exists public.save_registration_draft(uuid, uuid, public.food_preference, jsonb);
drop function if exists public.submit_registration(uuid, uuid, public.food_preference, jsonb);

create or replace function public.save_registration_draft(
  p_registration_id uuid,
  p_committee_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb,
  p_delegation_type public.delegation_type default 'SINGLE',
  p_partner_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_type public.delegation_type := coalesce(p_delegation_type, 'SINGLE');
begin
  perform public.ensure_email_verified();

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and user_id = v_user
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not v_reg.is_pair_lead then
    v_type := v_reg.delegation_type;
    p_committee_id := v_reg.committee_id;
  end if;

  if v_reg.status not in ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  if p_committee_id is not null then
    select * into v_committee
    from public.committees
    where id = p_committee_id
      and edition_id = v_reg.edition_id
      and deleted_at is null;
    if not found then
      raise exception 'COMMITTEE_NOT_FOUND';
    end if;
  end if;

  perform public.upsert_registration_values(v_reg.id, p_values);

  update public.registrations
  set
    committee_id = p_committee_id,
    food_preference = p_food_preference,
    delegation_type = v_type,
    partner_email = case when v_type = 'DOUBLE' then public.normalize_email(p_partner_email) else null end
  where id = v_reg.id
  returning * into v_reg;

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.submit_registration(
  p_registration_id uuid,
  p_committee_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb,
  p_delegation_type public.delegation_type default 'SINGLE',
  p_partner_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_reg public.registrations%rowtype;
  v_edition public.mun_editions%rowtype;
  v_committee public.committees%rowtype;
  v_taken int;
  v_type public.delegation_type := coalesce(p_delegation_type, 'SINGLE');
begin
  perform public.ensure_email_verified();

  if p_committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
  end if;
  if p_food_preference is null then
    raise exception 'FOOD_REQUIRED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and user_id = v_user
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not v_reg.is_pair_lead then
    v_type := v_reg.delegation_type;
    p_committee_id := v_reg.committee_id;
  end if;

  if v_reg.status not in ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  select * into v_edition from public.mun_editions where id = v_reg.edition_id;
  perform public.assert_registration_window(v_edition);

  select * into v_committee
  from public.committees
  where id = p_committee_id
    and edition_id = v_reg.edition_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'COMMITTEE_NOT_FOUND';
  end if;
  if v_committee.status <> 'OPEN' then
    raise exception 'COMMITTEE_CLOSED';
  end if;

  select count(distinct coalesce(r.pair_id, r.id))::int into v_taken
  from public.registrations r
  where r.committee_id = v_committee.id
    and r.deleted_at is null
    and r.status not in ('DRAFT', 'CANCELLED')
    and r.id <> v_reg.id
    and (v_reg.pair_id is null or r.pair_id is distinct from v_reg.pair_id);

  if v_taken >= v_committee.capacity then
    raise exception 'COMMITTEE_FULL';
  end if;

  perform public.upsert_registration_values(v_reg.id, p_values);

  update public.registrations
  set
    committee_id = v_committee.id,
    food_preference = p_food_preference,
    submitted_at = coalesce(v_reg.submitted_at, now())
  where id = v_reg.id;

  if v_reg.is_pair_lead then
    perform public.apply_delegation_pair(v_reg.id, v_committee.id, v_type, p_partner_email);
  end if;

  update public.registrations
  set
    status = 'PAYMENT_PENDING',
    expected_fee_minor = case
      when not is_pair_lead then 0
      else public.committee_current_fee(v_committee.id, delegation_type)
    end
  where id = v_reg.id
  returning * into v_reg;

  perform public.link_registration_to_payments(v_reg.id);
  if v_reg.partner_registration_id is not null then
    perform public.link_registration_to_payments(v_reg.partner_registration_id);
  end if;
  select * into v_reg from public.registrations where id = v_reg.id;

  perform public.write_audit(
    'registration.submit',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'committee_id', v_committee.id,
      'delegation_type', v_reg.delegation_type,
      'expected_fee_minor', v_reg.expected_fee_minor
    )
  );

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.start_or_get_payment(
  p_edition_id uuid,
  p_emails text[] default '{}',
  p_include_self boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_pay public.payments%rowtype;
  v_email extensions.citext;
  v_item text;
  v_seen extensions.citext[] := '{}';
  v_norm extensions.citext;
  v_partner extensions.citext;
begin
  perform public.ensure_email_verified();

  if not exists (
    select 1 from public.mun_editions e
    where e.id = p_edition_id and e.deleted_at is null
  ) then
    raise exception 'NOT_FOUND';
  end if;

  select * into v_pay
  from public.payments
  where payer_user_id = v_user
    and edition_id = p_edition_id
    and deleted_at is null
    and status = 'UNDER_REVIEW'
  order by created_at desc
  limit 1;
  if found then
    return public.payment_payload(v_pay.id);
  end if;

  select * into v_pay
  from public.payments
  where payer_user_id = v_user
    and edition_id = p_edition_id
    and deleted_at is null
    and status in ('DRAFT', 'PENDING', 'REJECTED')
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.payments (edition_id, payer_user_id, status, expected_amount_minor)
    values (p_edition_id, v_user, 'PENDING', 0)
    returning * into v_pay;
  elsif v_pay.status = 'DRAFT' then
    update public.payments set status = 'PENDING' where id = v_pay.id returning * into v_pay;
  end if;

  if p_include_self then
    select email into v_email from public.users where id = v_user;
    if v_email is not null
       and not exists (
         select 1 from public.payment_participants pp
         where pp.payment_id = v_pay.id
           and (pp.user_id = v_user or pp.unmatched_email = v_email)
       )
    then
      if not exists (
        select 1 from public.registrations r
        where r.user_id = v_user
          and r.edition_id = p_edition_id
          and r.status in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED')
          and r.deleted_at is null
      ) then
        raise exception 'REGISTRATION_INCOMPLETE';
      end if;
      perform public.attach_email_to_payment(v_pay.id, v_email);
    end if;
    v_seen := array_append(v_seen, v_email);

    select r.partner_email into v_partner
    from public.registrations r
    where r.user_id = v_user
      and r.edition_id = p_edition_id
      and r.deleted_at is null
      and r.status <> 'CANCELLED'
      and r.delegation_type = 'DOUBLE'
      and r.partner_email is not null
    limit 1;
    if v_partner is not null
       and v_partner is distinct from v_email
       and not exists (
         select 1 from public.payment_participants pp
         where pp.payment_id = v_pay.id
           and pp.unmatched_email = v_partner
       )
    then
      begin
        perform public.attach_email_to_payment(v_pay.id, v_partner);
      exception
        when others then
          if sqlerrm not like '%DUPLICATE_EMAIL%' and sqlerrm not like '%PAYMENT_ALREADY%' then
            raise;
          end if;
      end;
    end if;
  end if;

  foreach v_item in array coalesce(p_emails, '{}')
  loop
    v_norm := public.normalize_email(v_item);
    if v_norm is null then
      continue;
    end if;
    if v_norm = any (v_seen) then
      raise exception 'DUPLICATE_EMAIL_IN_LIST';
    end if;
    v_seen := array_append(v_seen, v_norm);
    perform public.attach_email_to_payment(v_pay.id, v_norm);
  end loop;

  if not exists (select 1 from public.payment_participants where payment_id = v_pay.id) then
    raise exception 'NO_PARTICIPANTS';
  end if;

  perform public.recalculate_payment_expected(v_pay.id);
  perform public.write_audit(
    'payment.start',
    'payments',
    v_pay.id,
    null,
    jsonb_build_object('edition_id', p_edition_id, 'include_self', p_include_self)
  );
  return public.payment_payload(v_pay.id);
end;
$$;

-- Keep allocation in sync for a double-del pair.
create or replace function public.sync_pair_allocation(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found or v_reg.partner_registration_id is null then
    return;
  end if;
  update public.registrations
  set allocated_slr = v_reg.allocated_slr, allocated_portfolio = v_reg.allocated_portfolio
  where id = v_reg.partner_registration_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.registration_phases enable row level security;
alter table public.committee_phase_fees enable row level security;
alter table public.edition_expenses enable row level security;

drop policy if exists registration_phases_select on public.registration_phases;
create policy registration_phases_select on public.registration_phases
  for select using (true);

drop policy if exists registration_phases_mutate on public.registration_phases;
create policy registration_phases_mutate on public.registration_phases
  for all using (public.has_permission('edition.manage', edition_id))
  with check (public.has_permission('edition.manage', edition_id));

drop policy if exists committee_phase_fees_select on public.committee_phase_fees;
create policy committee_phase_fees_select on public.committee_phase_fees
  for select using (true);

drop policy if exists committee_phase_fees_mutate on public.committee_phase_fees;
create policy committee_phase_fees_mutate on public.committee_phase_fees
  for all using (public.has_permission('committee.manage', null))
  with check (public.has_permission('committee.manage', null));

drop policy if exists edition_expenses_select on public.edition_expenses;
create policy edition_expenses_select on public.edition_expenses
  for select using (public.is_staff());

drop policy if exists edition_expenses_mutate on public.edition_expenses;
create policy edition_expenses_mutate on public.edition_expenses
  for all using (public.has_permission('edition.manage', edition_id))
  with check (public.has_permission('edition.manage', edition_id));

grant select on public.registration_phases to anon, authenticated, service_role;
grant insert, update, delete on public.registration_phases to authenticated, service_role;
grant select on public.committee_phase_fees to anon, authenticated, service_role;
grant insert, update, delete on public.committee_phase_fees to authenticated, service_role;
grant select, insert, update, delete on public.edition_expenses to authenticated, service_role;

grant execute on function public.ensure_edition_phases(uuid) to authenticated;
grant execute on function public.activate_registration_phase(uuid) to authenticated;
grant execute on function public.committee_current_fee(uuid, public.delegation_type) to anon, authenticated;
grant execute on function public.save_registration_draft(uuid, uuid, public.food_preference, jsonb, public.delegation_type, text) to authenticated;
grant execute on function public.submit_registration(uuid, uuid, public.food_preference, jsonb, public.delegation_type, text) to authenticated;
grant execute on function public.start_or_get_payment(uuid, text[], boolean) to authenticated;
grant execute on function public.sync_pair_allocation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dates + backfill
-- ---------------------------------------------------------------------------

update public.mun_editions
set
  start_date = '2026-11-20',
  end_date = '2026-11-22',
  name = coalesce(nullif(name, ''), 'Kautilya MUN 2026')
where year = 2026
   or slug = '2026'
   or id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

insert into public.mun_editions (
  name, year, slug, theme, start_date, end_date, status, is_public_active
)
select
  'Kautilya MUN 2025',
  2025,
  '2025',
  null,
  '2025-10-31',
  '2025-11-02',
  'ARCHIVED',
  false
where not exists (
  select 1 from public.mun_editions where slug = '2025' or year = 2025
);

do $$
declare
  v_ed uuid;
  v_c uuid;
begin
  for v_ed in select id from public.mun_editions where deleted_at is null
  loop
    perform public.ensure_edition_phases(v_ed);
  end loop;
  for v_c in select id from public.committees where deleted_at is null
  loop
    perform public.seed_committee_phase_fees(v_c);
  end loop;
end $$;

update public.committees
set allows_double_del = true
where short_name = 'UNSC';

notify pgrst, 'reload schema';
