-- Admin add participant: auto-verify email (app may also create the auth user).
-- Convert a SINGLE (paid or unpaid) registration into a DOUBLE with a partner;
-- committee stays the same; portfolio/SLR may be updated.

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
    -- Soft-reactivate for admin-managed adds (app should have activated already).
    update public.users
    set status = 'ACTIVE'
    where id = v_user.id
    returning * into v_user;
  end if;
  -- Admin-created / manually added participants are treated as verified.
  if v_user.email_verified_at is null then
    update public.users
    set email_verified_at = now()
    where id = v_user.id
    returning * into v_user;
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
      'edition_id', p_edition_id,
      'email', v_email::text,
      'delegation_type', v_type,
      'partner_email', public.normalize_email(p_partner_email),
      'collective_id', p_collective_id,
      'submitted_phase_id', v_phase
    )
  );

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.convert_registration_to_double(
  p_registration_id uuid,
  p_partner_email text,
  p_reason text,
  p_allocated_portfolio text default null,
  p_allocated_slr int default null,
  p_expected_fee_minor int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_partner_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_self extensions.citext;
  v_email extensions.citext;
  v_reason text;
  v_portfolio text;
  v_slr int;
  v_fee int;
  v_paid boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
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

  if v_reg.status in ('DRAFT', 'CANCELLED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  if not coalesce(v_reg.is_pair_lead, true) then
    raise exception 'NOT_PAIR_LEAD';
  end if;

  if v_reg.delegation_type = 'DOUBLE' and v_reg.partner_registration_id is not null then
    raise exception 'ALREADY_DOUBLE';
  end if;

  select email into v_self from public.users where id = v_reg.user_id;
  v_email := public.normalize_email(p_partner_email);
  if v_email is null then
    raise exception 'PARTNER_REQUIRED';
  end if;
  if v_email = v_self then
    raise exception 'PARTNER_SELF';
  end if;

  if v_reg.committee_id is not null then
    select * into v_committee
    from public.committees
    where id = v_reg.committee_id
      and deleted_at is null;
    if not found then
      raise exception 'COMMITTEE_NOT_FOUND';
    end if;
    if not v_committee.allows_double_del then
      raise exception 'DELEGATION_NOT_ALLOWED';
    end if;
  end if;

  -- Pair with partner (creates partner registration if needed). Partner user must exist.
  perform public.apply_delegation_pair(
    v_reg.id,
    v_reg.committee_id,
    'DOUBLE',
    p_partner_email
  );

  select * into v_reg from public.registrations where id = p_registration_id;
  if v_reg.partner_registration_id is null then
    raise exception 'PARTNER_REQUIRED';
  end if;

  select * into v_partner_reg
  from public.registrations
  where id = v_reg.partner_registration_id
  for update;

  v_paid := v_reg.status in ('PAYMENT_VERIFIED', 'CONFIRMED')
    or public.registration_has_verified_payment(v_reg.id)
    or coalesce(v_reg.confirmed_free, false);

  v_portfolio := nullif(btrim(coalesce(p_allocated_portfolio, '')), '');
  if v_portfolio is null then
    v_portfolio := v_reg.allocated_portfolio;
  end if;
  v_slr := coalesce(p_allocated_slr, v_reg.allocated_slr);

  -- Optional allotment change (same committee only).
  if v_reg.committee_id is not null and (
    v_portfolio is distinct from v_reg.allocated_portfolio
    or v_slr is distinct from v_reg.allocated_slr
  ) then
    if v_slr is not null then
      update public.registrations
      set allocated_slr = null
      where committee_id = v_reg.committee_id
        and allocated_slr = v_slr
        and id is distinct from v_reg.id
        and id is distinct from v_partner_reg.id;
    end if;
  end if;

  -- Fee: bump lead to double rate when allotted; partner always 0.
  if v_reg.committee_id is not null then
    if p_expected_fee_minor is not null then
      if p_expected_fee_minor < 0 then
        raise exception 'FEE_INVALID';
      end if;
      v_fee := p_expected_fee_minor;
    else
      v_fee := public.registration_allotment_fee(
        v_reg.committee_id,
        v_reg.submitted_phase_id,
        v_reg.edition_id,
        'DOUBLE'
      );
    end if;
  else
    v_fee := v_reg.expected_fee_minor;
  end if;

  update public.registrations
  set
    delegation_type = 'DOUBLE',
    is_pair_lead = true,
    allocated_portfolio = case
      when v_reg.committee_id is not null then v_portfolio
      else allocated_portfolio
    end,
    allocated_slr = case
      when v_reg.committee_id is not null then v_slr
      else allocated_slr
    end,
    expected_fee_minor = case
      when v_reg.committee_id is not null then v_fee
      else expected_fee_minor
    end
  where id = v_reg.id
  returning * into v_reg;

  update public.registrations
  set
    delegation_type = 'DOUBLE',
    is_pair_lead = false,
    committee_id = v_reg.committee_id,
    allocated_portfolio = v_reg.allocated_portfolio,
    allocated_slr = v_reg.allocated_slr,
    expected_fee_minor = 0,
    food_preference = coalesce(food_preference, v_reg.food_preference),
    collective_id = coalesce(collective_id, v_reg.collective_id),
    submitted_phase_id = coalesce(submitted_phase_id, v_reg.submitted_phase_id),
    submitted_at = coalesce(submitted_at, v_reg.submitted_at, now()),
    accepted_rules_at = coalesce(accepted_rules_at, now()),
    status = case
      when v_reg.status in ('CONFIRMED', 'PAYMENT_VERIFIED') then v_reg.status
      when v_reg.status = 'PAYMENT_PENDING' then 'PAYMENT_PENDING'
      when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status
      when status = 'DRAFT' then 'SUBMITTED'
      else status
    end,
    confirmed_at = case
      when v_reg.status = 'CONFIRMED' then coalesce(confirmed_at, now())
      else confirmed_at
    end,
    confirmed_free = case
      when v_reg.confirmed_free then true
      else confirmed_free
    end
  where id = v_partner_reg.id
  returning * into v_partner_reg;

  if v_reg.status = 'CONFIRMED' or coalesce(v_reg.confirmed_free, false) then
    perform public.confirm_registration_from_payment(v_partner_reg.id);
  elsif v_reg.status = 'PAYMENT_VERIFIED' then
    update public.registrations
    set status = 'PAYMENT_VERIFIED'
    where id = v_partner_reg.id
      and status not in ('CONFIRMED');
  end if;

  perform public.link_registration_to_payments(v_reg.id);
  perform public.link_registration_to_payments(v_partner_reg.id);

  select * into v_reg from public.registrations where id = p_registration_id;

  perform public.write_audit(
    'registration.convert_to_double',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'partner_email', v_email::text,
      'partner_registration_id', v_partner_reg.id,
      'committee_id', v_reg.committee_id,
      'allocated_portfolio', v_reg.allocated_portfolio,
      'allocated_slr', v_reg.allocated_slr,
      'expected_fee_minor', v_reg.expected_fee_minor,
      'was_paid', v_paid,
      'reason', v_reason
    )
  );

  return to_jsonb(v_reg);
end;
$$;

revoke all on function public.convert_registration_to_double(
  uuid, text, text, text, int, int
) from public;
grant execute on function public.convert_registration_to_double(
  uuid, text, text, text, int, int
) to authenticated, service_role;

comment on function public.convert_registration_to_double(
  uuid, text, text, text, int, int
) is
  'Convert a single-del registration to double with a partner (same committee; portfolio optional).';
