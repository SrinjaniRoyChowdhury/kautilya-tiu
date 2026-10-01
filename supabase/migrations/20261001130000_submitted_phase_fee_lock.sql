-- Lock payable fee to the registration phase active at first submission.
-- Late allotment (e.g. Early Bird submit → Phase 1 allot) still uses the submitted-phase price.

alter table public.registrations
  add column if not exists submitted_phase_id uuid
    references public.registration_phases (id) on delete set null;

create index if not exists registrations_submitted_phase_idx
  on public.registrations (submitted_phase_id)
  where submitted_phase_id is not null;

create or replace function public.committee_fee_for_phase(
  p_committee_id uuid,
  p_phase_id uuid,
  p_type public.delegation_type
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fallback int;
  v_amount int;
begin
  select fee_minor into v_fallback from public.committees where id = p_committee_id;
  if p_committee_id is null then
    return 0;
  end if;
  if p_phase_id is null then
    return public.committee_current_fee(p_committee_id, p_type);
  end if;

  select case
    when p_type = 'DOUBLE' then f.double_fee_minor
    else f.single_fee_minor
  end
  into v_amount
  from public.committee_phase_fees f
  where f.committee_id = p_committee_id
    and f.phase_id = p_phase_id
  limit 1;

  return coalesce(v_amount, v_fallback, 0);
end;
$$;

create or replace function public.registration_allotment_fee(
  p_committee_id uuid,
  p_submitted_phase_id uuid,
  p_edition_id uuid,
  p_type public.delegation_type
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phase uuid := p_submitted_phase_id;
begin
  if v_phase is null then
    select id into v_phase
    from public.registration_phases
    where edition_id = p_edition_id
      and is_active
    limit 1;
  end if;
  return public.committee_fee_for_phase(p_committee_id, v_phase, p_type);
end;
$$;

create or replace function public.active_phase_id(p_edition_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.registration_phases
  where edition_id = p_edition_id
    and is_active
  limit 1;
$$;

revoke all on function public.committee_fee_for_phase(uuid, uuid, public.delegation_type) from public;
revoke all on function public.registration_allotment_fee(uuid, uuid, uuid, public.delegation_type) from public;
revoke all on function public.active_phase_id(uuid) from public;
grant execute on function public.committee_fee_for_phase(uuid, uuid, public.delegation_type) to authenticated, service_role;
grant execute on function public.registration_allotment_fee(uuid, uuid, uuid, public.delegation_type) to authenticated, service_role;
grant execute on function public.active_phase_id(uuid) to authenticated, service_role;

-- Freeze phase on first submit (re-submit keeps the original).
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
  v_phase uuid;
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

  v_phase := coalesce(v_reg.submitted_phase_id, public.active_phase_id(v_reg.edition_id));

  update public.registrations
  set
    food_preference = p_food_preference,
    submitted_at = coalesce(v_reg.submitted_at, now()),
    submitted_phase_id = v_phase
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
    allocated_portfolio = null,
    submitted_phase_id = coalesce(submitted_phase_id, v_phase)
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      status = case when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status else 'SUBMITTED' end,
      committee_id = null,
      expected_fee_minor = null,
      submitted_phase_id = coalesce(submitted_phase_id, v_phase),
      submitted_at = coalesce(submitted_at, now())
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
      'delegation_type', v_reg.delegation_type,
      'submitted_phase_id', v_reg.submitted_phase_id
    )
  );

  return to_jsonb(v_reg);
end;
$$;

-- Admin-created registrations also lock the active phase at create/submit time.
create or replace function public.admin_create_submitted_registration(
  p_edition_id uuid,
  p_email text,
  p_food_preference public.food_preference,
  p_values jsonb,
  p_delegation_type public.delegation_type default 'SINGLE',
  p_partner_email text default null,
  p_preferences jsonb default '[]'::jsonb,
  p_collective_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email extensions.citext;
  v_user public.users%rowtype;
  v_edition public.mun_editions%rowtype;
  v_reg public.registrations%rowtype;
  v_type public.delegation_type := coalesce(p_delegation_type, 'SINGLE');
  v_item jsonb;
  v_committee public.committees%rowtype;
  v_phase uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.has_permission('registration.edit', p_edition_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_food_preference is null then
    raise exception 'FOOD_REQUIRED';
  end if;

  select * into v_edition from public.mun_editions where id = p_edition_id;
  if not found then
    raise exception 'EDITION_NOT_FOUND';
  end if;

  v_email := public.normalize_email(p_email);
  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select * into v_user
  from public.users
  where email = v_email
    and deleted_at is null;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_user.status is distinct from 'ACTIVE' then
    raise exception 'USER_INACTIVE';
  end if;
  if v_user.email_verified_at is null then
    raise exception 'EMAIL_UNVERIFIED';
  end if;

  select * into v_reg
  from public.registrations
  where user_id = v_user.id
    and edition_id = p_edition_id
    and deleted_at is null
    and status <> 'CANCELLED'
  for update;
  if found then
    raise exception 'ALREADY_REGISTERED';
  end if;

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
      and edition_id = p_edition_id
      and deleted_at is null;
    if not found then
      raise exception 'COMMITTEE_NOT_FOUND';
    end if;
    if v_committee.status <> 'OPEN' then
      raise exception 'COMMITTEE_CLOSED';
    end if;
  end loop;

  v_phase := public.active_phase_id(p_edition_id);

  insert into public.registrations (
    edition_id,
    user_id,
    status,
    food_preference,
    delegation_type,
    is_pair_lead,
    collective_id,
    accepted_rules_at,
    submitted_at,
    submitted_phase_id
  ) values (
    p_edition_id,
    v_user.id,
    'DRAFT',
    p_food_preference,
    v_type,
    true,
    p_collective_id,
    now(),
    now(),
    v_phase
  )
  returning * into v_reg;

  perform public.upsert_registration_values(v_reg.id, p_values);
  perform public.apply_delegation_pair(v_reg.id, null, v_type, p_partner_email);
  perform public.replace_registration_preferences(v_reg.id, p_preferences, true);

  update public.registrations
  set
    status = 'SUBMITTED',
    committee_id = null,
    expected_fee_minor = null,
    allocated_slr = null,
    allocated_portfolio = null,
    food_preference = p_food_preference,
    collective_id = p_collective_id,
    submitted_at = coalesce(submitted_at, now()),
    accepted_rules_at = coalesce(accepted_rules_at, now()),
    submitted_phase_id = coalesce(submitted_phase_id, v_phase)
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      status = case when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status else 'SUBMITTED' end,
      committee_id = null,
      expected_fee_minor = null,
      submitted_phase_id = coalesce(submitted_phase_id, v_phase),
      submitted_at = coalesce(submitted_at, now())
    where id = v_reg.partner_registration_id
      and status not in ('CONFIRMED', 'PAYMENT_VERIFIED');
  end if;

  perform public.write_audit(
    'registration.admin_create',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'email', v_email::text,
      'edition_id', p_edition_id,
      'preferences', p_preferences,
      'delegation_type', v_reg.delegation_type,
      'submitted_phase_id', v_reg.submitted_phase_id
    )
  );

  return to_jsonb(v_reg);
end;
$$;

-- Allotment uses submitted-phase fee (not the currently active phase).
create or replace function public.allocate_registration(
  p_registration_id uuid,
  p_committee_id uuid,
  p_portfolio text,
  p_slr int default null,
  p_expected_fee_minor int default null
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
  v_phase uuid;
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

  v_portfolio := nullif(btrim(coalesce(p_portfolio, '')), '');
  if v_portfolio is null and not coalesce(v_committee.is_special_crisis, false) then
    raise exception 'PORTFOLIO_REQUIRED';
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

  if v_slr is not null then
    update public.registrations
    set allocated_slr = null, allocated_portfolio = null
    where committee_id = v_committee.id
      and allocated_slr = v_slr
      and id is distinct from v_reg.id
      and (v_reg.partner_registration_id is null or id is distinct from v_reg.partner_registration_id);
  end if;

  -- Freeze phase at allotment if somehow missing (legacy rows).
  v_phase := coalesce(v_reg.submitted_phase_id, public.active_phase_id(v_reg.edition_id));

  if not coalesce(v_reg.is_pair_lead, true) then
    v_fee := 0;
  elsif coalesce(v_reg.is_outstation, false) then
    if p_expected_fee_minor is null or p_expected_fee_minor <= 0 then
      raise exception 'OUTSTATION_FEE_REQUIRED';
    end if;
    v_fee := p_expected_fee_minor;
  elsif p_expected_fee_minor is not null then
    if p_expected_fee_minor <= 0 then
      raise exception 'FEE_ZERO_NOT_ALLOWED';
    end if;
    v_fee := p_expected_fee_minor;
  else
    v_fee := public.registration_allotment_fee(
      v_committee.id,
      v_phase,
      v_reg.edition_id,
      coalesce(v_reg.delegation_type, 'SINGLE')
    );
    if coalesce(v_fee, 0) <= 0 then
      raise exception 'FEE_ZERO_NOT_ALLOWED';
    end if;
  end if;

  update public.registrations
  set
    committee_id = v_committee.id,
    allocated_portfolio = v_portfolio,
    allocated_slr = v_slr,
    expected_fee_minor = v_fee,
    status = 'PAYMENT_PENDING',
    confirmed_free = false,
    submitted_phase_id = coalesce(submitted_phase_id, v_phase)
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      committee_id = v_committee.id,
      allocated_portfolio = v_portfolio,
      allocated_slr = v_slr,
      expected_fee_minor = case when is_pair_lead then v_fee else 0 end,
      status = case
        when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status
        else 'PAYMENT_PENDING'
      end,
      delegation_type = 'DOUBLE',
      confirmed_free = case
        when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then confirmed_free
        else false
      end,
      submitted_phase_id = coalesce(submitted_phase_id, v_phase)
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
      'expected_fee_minor', v_reg.expected_fee_minor,
      'submitted_phase_id', v_reg.submitted_phase_id,
      'is_special_crisis', coalesce(v_committee.is_special_crisis, false),
      'is_outstation', coalesce(v_reg.is_outstation, false),
      'fee_manual', p_expected_fee_minor is not null
    )
  );

  return to_jsonb(v_reg);
end;
$$;

-- Phase change: refresh unpaid allotted fees from THEIR submitted phase (not the new active phase).
create or replace function public.activate_registration_phase(p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition uuid;
  v_reg_id uuid;
  v_pay_id uuid;
begin
  if not public.has_permission('edition.manage', null) then
    raise exception 'FORBIDDEN';
  end if;
  select edition_id into v_edition from public.registration_phases where id = p_phase_id;
  if v_edition is null then
    raise exception 'NOT_FOUND';
  end if;

  update public.registration_phases
  set is_active = false
  where edition_id = v_edition
    and is_active
    and id is distinct from p_phase_id;

  update public.registration_phases
  set is_active = true
  where id = p_phase_id
    and edition_id = v_edition;

  update public.committees c
  set fee_minor = public.committee_current_fee(c.id, 'SINGLE')
  where c.edition_id = v_edition and c.deleted_at is null;

  -- Keep each unpaid allotted lead on the fee of the phase they submitted under.
  update public.registrations r
  set expected_fee_minor = public.registration_allotment_fee(
    r.committee_id,
    r.submitted_phase_id,
    r.edition_id,
    coalesce(r.delegation_type, 'SINGLE')
  )
  where r.edition_id = v_edition
    and r.deleted_at is null
    and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED')
    and r.committee_id is not null
    and r.submitted_phase_id is not null
    and coalesce(r.is_pair_lead, true)
    and not coalesce(r.is_outstation, false)
    and not coalesce(r.confirmed_free, false)
    and not public.registration_payment_locked(r.id);

  for v_reg_id in
    select r.id
    from public.registrations r
    where r.edition_id = v_edition
      and r.deleted_at is null
      and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED')
      and r.committee_id is not null
      and not public.registration_payment_locked(r.id)
  loop
    perform public.link_registration_to_payments(v_reg_id);
  end loop;

  for v_pay_id in
    select distinct p.id
    from public.payments p
    where p.edition_id = v_edition
      and p.deleted_at is null
      and p.status in ('DRAFT', 'PENDING', 'REJECTED')
  loop
    perform public.recalculate_payment_expected(v_pay_id);
  end loop;

  perform public.write_audit(
    'phase.activate_refresh_fees',
    'registration_phases',
    p_phase_id,
    null,
    jsonb_build_object(
      'edition_id', v_edition,
      'policy', 'submitted_phase_fee'
    )
  );
end;
$$;

-- No historical backfill of submitted_phase_id (we do not know which phase was
-- active at each past submission). Going forward, submit locks the active phase.
-- Legacy unallotted rows fall back to the active phase at allotment time; Super Admin
-- can still override fee / confirm at a previous-phase amount.

notify pgrst, 'reload schema';
