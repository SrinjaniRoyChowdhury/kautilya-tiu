-- After allotment, a phase change bumps unpaid allotted fees to the NEW active phase.
-- Previous-phase amount may only be set manually by Super Admin (allocate override / confirm).

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

  v_phase := coalesce(v_reg.submitted_phase_id, public.active_phase_id(v_reg.edition_id));

  if not coalesce(v_reg.is_pair_lead, true) then
    v_fee := 0;
  elsif coalesce(v_reg.is_outstation, false) then
    -- Outstation uses its own schedule; staff enter the fee.
    if p_expected_fee_minor is null or p_expected_fee_minor <= 0 then
      raise exception 'OUTSTATION_FEE_REQUIRED';
    end if;
    v_fee := p_expected_fee_minor;
  elsif p_expected_fee_minor is not null then
    -- Manual previous-phase (or custom) amount: Super Admin only.
    if not public.is_super_admin() then
      raise exception 'FEE_OVERRIDE_FORBIDDEN';
    end if;
    if p_expected_fee_minor <= 0 then
      raise exception 'FEE_ZERO_NOT_ALLOWED';
    end if;
    v_fee := p_expected_fee_minor;
  else
    -- Default: fee of the phase active at first submission (secretariat delay is on us).
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

-- Phase change after allotment: unpaid allotted paying leads move to the NEW active phase fee.
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

  update public.registrations r
  set expected_fee_minor = public.committee_current_fee(
    r.committee_id,
    coalesce(r.delegation_type, 'SINGLE')
  )
  where r.edition_id = v_edition
    and r.deleted_at is null
    and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED')
    and r.committee_id is not null
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
      'policy', 'current_phase_after_allotment'
    )
  );
end;
$$;

notify pgrst, 'reload schema';
