-- Committee preferences (2–3), per-preference portfolios, allocate-before-pay.

alter table public.mun_editions
  add column if not exists portfolio_matrix_url text;

create table if not exists public.registration_preferences (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  preference_order smallint not null check (preference_order between 1 and 3),
  committee_id uuid not null references public.committees (id) on delete restrict,
  portfolio_1 text not null,
  portfolio_2 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, preference_order),
  unique (registration_id, committee_id)
);

create index if not exists registration_preferences_committee_idx
  on public.registration_preferences (committee_id);

drop trigger if exists registration_preferences_set_updated_at on public.registration_preferences;
create trigger registration_preferences_set_updated_at
  before update on public.registration_preferences
  for each row execute function public.set_updated_at();

alter table public.registration_preferences enable row level security;

drop policy if exists registration_preferences_select on public.registration_preferences;
create policy registration_preferences_select on public.registration_preferences
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('registration.view', r.edition_id))
    )
  );

drop policy if exists registration_preferences_mutate on public.registration_preferences;
create policy registration_preferences_mutate on public.registration_preferences
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('registration.edit', r.edition_id))
    )
  );

grant select, insert, update, delete on public.registration_preferences to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Field definitions: drop retired fields, add MUN experience details
-- ---------------------------------------------------------------------------

delete from public.registration_field_values
where field_definition_id in (
  select id from public.registration_field_definitions
  where field_key in ('portfolio_pref_1', 'portfolio_pref_2', 'dietary_notes', 'accommodation')
);

delete from public.registration_field_definitions
where field_key in ('portfolio_pref_1', 'portfolio_pref_2', 'dietary_notes', 'accommodation');

insert into public.registration_field_definitions (
  edition_id, field_key, label, field_type, required, options, validation, display_order, section
)
select
  e.id,
  'mun_experience_details',
  'Prior MUN experience details',
  'text',
  false,
  null,
  '{"max":2000}'::jsonb,
  5,
  'MUN_INFO'
from public.mun_editions e
where e.deleted_at is null
  and not exists (
    select 1
    from public.registration_field_definitions d
    where d.edition_id = e.id and d.field_key = 'mun_experience_details'
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.registration_is_allocated(p_status public.registration_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('PAYMENT_PENDING', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'CONFIRMED');
$$;

create or replace function public.replace_registration_preferences(
  p_registration_id uuid,
  p_preferences jsonb,
  p_require_complete boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_item jsonb;
  v_order int := 0;
  v_committee public.committees%rowtype;
  v_p1 text;
  v_p2 text;
  v_ids uuid[] := '{}';
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if p_require_complete then
    if jsonb_typeof(p_preferences) is distinct from 'array'
       or jsonb_array_length(coalesce(p_preferences, '[]'::jsonb)) < 2
       or jsonb_array_length(p_preferences) > 3 then
      raise exception 'PREFERENCES_REQUIRED';
    end if;
  end if;

  delete from public.registration_preferences where registration_id = p_registration_id;

  if p_preferences is null or jsonb_typeof(p_preferences) is distinct from 'array' then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_preferences)
  loop
    v_order := v_order + 1;
    if v_order > 3 then
      raise exception 'PREFERENCES_REQUIRED';
    end if;

    if (v_item->>'committee_id') is null or (v_item->>'committee_id') = '' then
      if p_require_complete then
        raise exception 'COMMITTEE_REQUIRED';
      end if;
      continue;
    end if;

    select * into v_committee
    from public.committees
    where id = (v_item->>'committee_id')::uuid
      and edition_id = v_reg.edition_id
      and deleted_at is null;
    if not found then
      raise exception 'COMMITTEE_NOT_FOUND';
    end if;
    if v_committee.id = any (v_ids) then
      raise exception 'PREFERENCE_DUPLICATE';
    end if;
    v_ids := array_append(v_ids, v_committee.id);

    v_p1 := nullif(btrim(coalesce(v_item->>'portfolio_1', '')), '');
    v_p2 := nullif(btrim(coalesce(v_item->>'portfolio_2', '')), '');
    if p_require_complete and v_p1 is null then
      raise exception 'PORTFOLIO_REQUIRED';
    end if;
    if v_p2 is not null and v_p1 is not null and lower(v_p2) = lower(v_p1) then
      raise exception 'PORTFOLIO_DUPLICATE';
    end if;

    if v_p1 is null and v_p2 is null and not p_require_complete then
      insert into public.registration_preferences (
        registration_id, preference_order, committee_id, portfolio_1, portfolio_2
      ) values (
        p_registration_id, v_order, v_committee.id, coalesce(v_p1, ''), v_p2
      );
    else
      insert into public.registration_preferences (
        registration_id, preference_order, committee_id, portfolio_1, portfolio_2
      ) values (
        p_registration_id, v_order, v_committee.id, coalesce(v_p1, ''), v_p2
      );
    end if;
  end loop;

  if v_reg.partner_registration_id is not null and v_reg.is_pair_lead then
    delete from public.registration_preferences where registration_id = v_reg.partner_registration_id;
    insert into public.registration_preferences (
      registration_id, preference_order, committee_id, portfolio_1, portfolio_2
    )
    select
      v_reg.partner_registration_id, preference_order, committee_id, portfolio_1, portfolio_2
    from public.registration_preferences
    where registration_id = p_registration_id;
  end if;
end;
$$;

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
    and public.registration_is_allocated(r.status)
  where c.edition_id = p_edition_id
    and c.deleted_at is null
  group by c.id;
$$;

-- Pairing no longer assigns a committee or fee; allocation does that.
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

  if p_committee_id is not null then
    select * into v_committee from public.committees where id = p_committee_id;
    if p_delegation_type = 'DOUBLE' and not v_committee.allows_double_del then
      raise exception 'DELEGATION_NOT_ALLOWED';
    end if;
    if p_delegation_type = 'SINGLE' and not v_committee.allows_single_del then
      raise exception 'DELEGATION_NOT_ALLOWED';
    end if;
  end if;

  if p_delegation_type = 'SINGLE' then
    perform public.clear_delegation_pair(v_reg.id);
    update public.registrations
    set
      delegation_type = 'SINGLE',
      is_pair_lead = true
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
       and p_committee_id is not null
       and v_partner_reg.committee_id is distinct from p_committee_id
       and public.registration_is_allocated(v_partner_reg.status) then
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
      v_reg.edition_id, v_partner.id, p_committee_id, 'SUBMITTED', 'DOUBLE',
      null, v_pair, false, v_self, v_reg.id
    )
    returning * into v_partner_reg;
  else
    update public.registrations
    set
      committee_id = coalesce(p_committee_id, committee_id),
      status = case
        when status = 'DRAFT' then 'SUBMITTED'
        else status
      end,
      delegation_type = 'DOUBLE',
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
    partner_registration_id = v_partner_reg.id
  where id = v_reg.id;
end;
$$;

drop function if exists public.save_registration_draft(uuid, uuid, public.food_preference, jsonb, public.delegation_type, text);
drop function if exists public.submit_registration(uuid, uuid, public.food_preference, jsonb, public.delegation_type, text);

create or replace function public.save_registration_draft(
  p_registration_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb,
  p_delegation_type public.delegation_type default 'SINGLE',
  p_partner_email text default null,
  p_preferences jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_reg public.registrations%rowtype;
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
  end if;
  if v_reg.status not in ('DRAFT', 'SUBMITTED') then
    v_type := v_reg.delegation_type;
  end if;

  if v_reg.status not in ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  perform public.upsert_registration_values(v_reg.id, p_values);

  update public.registrations
  set
    food_preference = p_food_preference,
    delegation_type = v_type,
    partner_email = case
      when status not in ('DRAFT', 'SUBMITTED') then partner_email
      when v_type = 'DOUBLE' then public.normalize_email(p_partner_email)
      else partner_email
    end
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.is_pair_lead and v_reg.status in ('DRAFT', 'SUBMITTED') then
    perform public.replace_registration_preferences(v_reg.id, p_preferences, false);
  end if;

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.submit_registration(
  p_registration_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb,
  p_delegation_type public.delegation_type default 'SINGLE',
  p_partner_email text default null,
  p_preferences jsonb default '[]'::jsonb
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
  v_type public.delegation_type := coalesce(p_delegation_type, 'SINGLE');
  v_item jsonb;
  v_committee public.committees%rowtype;
begin
  perform public.ensure_email_verified();

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
  end if;

  if v_reg.status not in ('DRAFT', 'SUBMITTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  select * into v_edition from public.mun_editions where id = v_reg.edition_id;
  perform public.assert_registration_window(v_edition);

  if v_reg.is_pair_lead then
    if jsonb_typeof(p_preferences) is distinct from 'array'
       or jsonb_array_length(coalesce(p_preferences, '[]'::jsonb)) < 2
       or jsonb_array_length(p_preferences) > 3 then
      raise exception 'PREFERENCES_REQUIRED';
    end if;
    for v_item in select * from jsonb_array_elements(p_preferences)
    loop
      select * into v_committee
      from public.committees
      where id = (v_item->>'committee_id')::uuid
        and edition_id = v_reg.edition_id
        and deleted_at is null;
      if not found then
        raise exception 'COMMITTEE_NOT_FOUND';
      end if;
      if v_committee.status <> 'OPEN' then
        raise exception 'COMMITTEE_CLOSED';
      end if;
    end loop;
  end if;

  perform public.upsert_registration_values(v_reg.id, p_values);

  update public.registrations
  set
    food_preference = p_food_preference,
    submitted_at = coalesce(v_reg.submitted_at, now())
  where id = v_reg.id;

  if v_reg.is_pair_lead then
    perform public.apply_delegation_pair(v_reg.id, null, v_type, p_partner_email);
    perform public.replace_registration_preferences(v_reg.id, p_preferences, true);
  end if;

  update public.registrations
  set
    status = 'SUBMITTED',
    committee_id = null,
    expected_fee_minor = null,
    allocated_slr = null,
    allocated_portfolio = null
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      status = case when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status else 'SUBMITTED' end,
      committee_id = null,
      expected_fee_minor = null
    where id = v_reg.partner_registration_id
      and status not in ('CONFIRMED', 'PAYMENT_VERIFIED');
  end if;

  perform public.write_audit(
    'registration.submit',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'preferences', p_preferences,
      'delegation_type', v_reg.delegation_type
    )
  );

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.allocate_registration(
  p_registration_id uuid,
  p_committee_id uuid,
  p_portfolio text,
  p_slr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_taken int;
  v_slr int;
  v_portfolio text;
  v_fee int;
  v_item jsonb;
  v_found boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not public.has_permission('registration.edit', v_reg.edition_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_reg.status not in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  if p_committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
  end if;
  v_portfolio := nullif(btrim(coalesce(p_portfolio, '')), '');
  if v_portfolio is null then
    raise exception 'PORTFOLIO_REQUIRED';
  end if;

  select * into v_committee
  from public.committees
  where id = p_committee_id
    and edition_id = v_reg.edition_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'COMMITTEE_NOT_FOUND';
  end if;
  if v_committee.status <> 'OPEN' and v_reg.committee_id is distinct from p_committee_id then
    raise exception 'COMMITTEE_CLOSED';
  end if;

  if v_reg.delegation_type = 'DOUBLE' and not v_committee.allows_double_del then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;
  if coalesce(v_reg.delegation_type, 'SINGLE') = 'SINGLE' and not coalesce(v_committee.allows_single_del, true) then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;

  select count(distinct coalesce(r.pair_id, r.id))::int into v_taken
  from public.registrations r
  where r.committee_id = v_committee.id
    and r.deleted_at is null
    and public.registration_is_allocated(r.status)
    and r.id <> v_reg.id
    and (v_reg.pair_id is null or r.pair_id is distinct from v_reg.pair_id);

  if v_taken >= v_committee.capacity then
    raise exception 'COMMITTEE_FULL';
  end if;

  v_slr := p_slr;
  if v_slr is null then
    for v_item in select * from jsonb_array_elements(coalesce(v_committee.portfolio_config, '[]'::jsonb))
    loop
      if lower(btrim(coalesce(v_item->>'name', ''))) = lower(v_portfolio) then
        v_found := true;
        if (v_item->>'slr') is not null and (v_item->>'slr') ~ '^[0-9]+$' then
          v_slr := (v_item->>'slr')::int;
        end if;
        v_portfolio := coalesce(nullif(btrim(v_item->>'name'), ''), v_portfolio);
        exit;
      end if;
    end loop;
  end if;

  if v_slr is not null then
    update public.registrations
    set allocated_slr = null, allocated_portfolio = null
    where committee_id = v_committee.id
      and allocated_slr = v_slr
      and id is distinct from v_reg.id
      and (v_reg.partner_registration_id is null or id is distinct from v_reg.partner_registration_id);
  end if;

  v_fee := case
    when not coalesce(v_reg.is_pair_lead, true) then 0
    else public.committee_current_fee(v_committee.id, coalesce(v_reg.delegation_type, 'SINGLE'))
  end;

  update public.registrations
  set
    committee_id = v_committee.id,
    allocated_portfolio = v_portfolio,
    allocated_slr = v_slr,
    expected_fee_minor = v_fee,
    status = 'PAYMENT_PENDING'
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      committee_id = v_committee.id,
      allocated_portfolio = v_portfolio,
      allocated_slr = v_slr,
      expected_fee_minor = case when is_pair_lead then public.committee_current_fee(v_committee.id, 'DOUBLE') else 0 end,
      status = case
        when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status
        else 'PAYMENT_PENDING'
      end,
      delegation_type = 'DOUBLE'
    where id = v_reg.partner_registration_id
      and deleted_at is null
      and status not in ('CANCELLED');
  end if;

  perform public.link_registration_to_payments(v_reg.id);
  if v_reg.partner_registration_id is not null then
    perform public.link_registration_to_payments(v_reg.partner_registration_id);
  end if;
  select * into v_reg from public.registrations where id = v_reg.id;

  perform public.write_audit(
    'registration.allocate',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'committee_id', v_committee.id,
      'allocated_portfolio', v_portfolio,
      'allocated_slr', v_slr,
      'expected_fee_minor', v_reg.expected_fee_minor
    )
  );

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.link_registration_to_payments(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_email extensions.citext;
  v_pay_id uuid;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    return;
  end if;
  if v_reg.status not in ('PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    return;
  end if;
  if v_reg.expected_fee_minor is null then
    return;
  end if;

  select email into v_email from public.users where id = v_reg.user_id;

  update public.payment_participants pp
  set
    registration_id = v_reg.id,
    user_id = v_reg.user_id,
    amount_minor = coalesce(v_reg.expected_fee_minor, pp.amount_minor, 0)
  from public.payments p
  where pp.payment_id = p.id
    and p.edition_id = v_reg.edition_id
    and p.deleted_at is null
    and public.payment_blocks_email(p.status)
    and (
      pp.registration_id = v_reg.id
      or (
        pp.registration_id is null
        and (
          pp.user_id = v_reg.user_id
          or pp.unmatched_email = v_email
        )
      )
    );

  for v_pay_id in
    select distinct pp.payment_id
    from public.payment_participants pp
    join public.payments p on p.id = pp.payment_id
    where pp.registration_id = v_reg.id
      and p.deleted_at is null
  loop
    perform public.recalculate_payment_expected(v_pay_id);
    if exists (
      select 1 from public.payments p
      where p.id = v_pay_id and p.status = 'VERIFIED'
    ) then
      perform public.confirm_registration_from_payment(v_reg.id);
    end if;
  end loop;
end;
$$;

create or replace function public.attach_email_to_payment(p_payment_id uuid, p_email extensions.citext)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_user public.users%rowtype;
  v_reg public.registrations%rowtype;
  v_amount int := 0;
  v_part_id uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if v_pay.status not in ('DRAFT', 'PENDING', 'REJECTED') then
    raise exception 'PAYMENT_LOCKED';
  end if;

  perform public.assert_email_free_for_payment(v_pay.edition_id, p_email, v_pay.id);

  if exists (
    select 1 from public.payment_participants pp
    where pp.payment_id = p_payment_id
      and (
        pp.unmatched_email = p_email
        or pp.user_id in (select u.id from public.users u where u.email = p_email)
      )
  ) then
    raise exception 'DUPLICATE_EMAIL_IN_LIST';
  end if;

  select * into v_user
  from public.users
  where email = p_email and deleted_at is null;
  if not found then
    raise exception 'NOT_REGISTERED';
  end if;

  select * into v_reg
  from public.registrations
  where user_id = v_user.id
    and edition_id = v_pay.edition_id
    and status <> 'CANCELLED'
    and deleted_at is null;
  if not found then
    raise exception 'NOT_REGISTERED';
  end if;
  if v_reg.status in ('PAYMENT_VERIFIED', 'CONFIRMED') then
    raise exception 'PAYMENT_ALREADY_VERIFIED';
  end if;
  if v_reg.status = 'SUBMITTED' or v_reg.committee_id is null or v_reg.expected_fee_minor is null then
    raise exception 'ALLOCATION_PENDING';
  end if;
  if v_reg.status not in ('PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'NOT_REGISTERED';
  end if;

  v_amount := v_reg.expected_fee_minor;
  insert into public.payment_participants (
    payment_id, registration_id, user_id, unmatched_email, amount_minor
  ) values (
    p_payment_id, v_reg.id, v_user.id, p_email, v_amount
  )
  returning id into v_part_id;

  perform public.recalculate_payment_expected(p_payment_id);
  return v_part_id;
end;
$$;

create or replace function public.search_payable_delegates(p_edition_id uuid, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_edition_id is null or char_length(v_q) < 1 then
    return '[]'::jsonb;
  end if;
  v_q := replace(replace(v_q, '%', '\%'), '_', '\_');

  return (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select
        u.email::text as email,
        u.full_name,
        c.short_name as committee,
        r.expected_fee_minor as fee_minor,
        r.id as registration_id
      from public.registrations r
      join public.users u on u.id = r.user_id
      left join public.committees c on c.id = r.committee_id
      where r.edition_id = p_edition_id
        and r.deleted_at is null
        and r.user_id is distinct from auth.uid()
        and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED')
        and r.committee_id is not null
        and r.expected_fee_minor is not null
        and (
          u.email::text ilike ('%' || v_q || '%') escape '\'
          or u.full_name ilike ('%' || v_q || '%') escape '\'
        )
        and not exists (
          select 1
          from public.payment_participants pp
          join public.payments p on p.id = pp.payment_id
          where p.edition_id = p_edition_id
            and p.deleted_at is null
            and public.payment_blocks_email(p.status)
            and (pp.user_id = r.user_id or pp.registration_id = r.id)
        )
      order by u.email
      limit 15
    ) x
  );
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
      if exists (
        select 1 from public.registrations r
        where r.user_id = v_user
          and r.edition_id = p_edition_id
          and r.status = 'SUBMITTED'
          and r.deleted_at is null
      ) then
        raise exception 'ALLOCATION_PENDING';
      end if;
      if not exists (
        select 1 from public.registrations r
        where r.user_id = v_user
          and r.edition_id = p_edition_id
          and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED')
          and r.committee_id is not null
          and r.expected_fee_minor is not null
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
          if sqlerrm not like '%DUPLICATE_EMAIL%'
             and sqlerrm not like '%PAYMENT_ALREADY%'
             and sqlerrm not like '%ALLOCATION_PENDING%' then
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

create or replace function public.confirm_registration_free(p_registration_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_user public.users%rowtype;
begin
  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not public.has_permission('registration.edit', v_reg.edition_id) then
    raise exception 'FORBIDDEN';
  end if;

  if v_reg.status in ('DRAFT', 'CANCELLED') then
    raise exception 'NOT_REGISTERED';
  end if;

  if v_reg.committee_id is null or v_reg.status = 'SUBMITTED' then
    raise exception 'ALLOCATION_REQUIRED';
  end if;

  if v_reg.status = 'CONFIRMED' and v_reg.confirmed_free then
    return v_reg;
  end if;

  if v_reg.status in ('CONFIRMED', 'PAYMENT_VERIFIED') then
    raise exception 'ALREADY_PAID';
  end if;

  if public.registration_has_verified_payment(v_reg.id) then
    raise exception 'ALREADY_PAID';
  end if;

  update public.registrations
  set
    status = 'CONFIRMED',
    confirmed_free = true,
    confirmed_at = coalesce(confirmed_at, now())
  where id = v_reg.id
  returning * into v_reg;

  perform public.issue_qr_for_registration(v_reg.id);

  select * into v_user from public.users where id = v_reg.user_id;

  insert into public.email_logs (user_id, to_email, template_key, status, error)
  values (
    v_reg.user_id,
    v_user.email,
    'QR_ISSUED',
    'QUEUED',
    'Free confirmation by admin — no payment recorded.'
  );

  insert into public.notifications (user_id, type, payload)
  values (
    v_reg.user_id,
    'registration.confirmed',
    jsonb_build_object(
      'registration_id', v_reg.id,
      'edition_id', v_reg.edition_id,
      'confirmed_free', true
    )
  );

  perform public.write_audit(
    'registration.confirm_free',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object('status', 'CONFIRMED', 'confirmed_free', true)
  );

  return v_reg;
end;
$$;

revoke all on function public.registration_is_allocated(public.registration_status) from public;
revoke all on function public.replace_registration_preferences(uuid, jsonb, boolean) from public;
revoke all on function public.allocate_registration(uuid, uuid, text, int) from public;
revoke all on function public.save_registration_draft(uuid, public.food_preference, jsonb, public.delegation_type, text, jsonb) from public;
revoke all on function public.submit_registration(uuid, public.food_preference, jsonb, public.delegation_type, text, jsonb) from public;

grant execute on function public.registration_is_allocated(public.registration_status) to authenticated;
grant execute on function public.replace_registration_preferences(uuid, jsonb, boolean) to authenticated;
grant execute on function public.allocate_registration(uuid, uuid, text, int) to authenticated;
grant execute on function public.save_registration_draft(uuid, public.food_preference, jsonb, public.delegation_type, text, jsonb) to authenticated;
grant execute on function public.submit_registration(uuid, public.food_preference, jsonb, public.delegation_type, text, jsonb) to authenticated;
grant execute on function public.apply_delegation_pair(uuid, uuid, public.delegation_type, text) to authenticated;
grant execute on function public.start_or_get_payment(uuid, text[], boolean) to authenticated;
grant execute on function public.search_payable_delegates(uuid, text) to authenticated;
grant execute on function public.confirm_registration_free(uuid) to authenticated;

notify pgrst, 'reload schema';
