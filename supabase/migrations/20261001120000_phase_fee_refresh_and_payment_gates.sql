-- Payment only after allotment with non-zero expected fee (unless free / double partner).
-- Phase activation refreshes unpaid allotted fees to the new phase.
-- Super Admin may manually confirm with proof at a previous-phase amount.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'SUPER_ADMIN'
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- Allotment: expected fee must be > 0 for paying leads; partners stay 0.
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

  if not coalesce(v_reg.is_pair_lead, true) then
    -- Non-lead of a double pair: fee lives on the lead.
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
    v_fee := public.committee_current_fee(v_committee.id, coalesce(v_reg.delegation_type, 'SINGLE'));
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
    confirmed_free = false
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
      end
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
      'is_special_crisis', coalesce(v_committee.is_special_crisis, false),
      'is_outstation', coalesce(v_reg.is_outstation, false),
      'fee_manual', p_expected_fee_minor is not null
    )
  );

  return to_jsonb(v_reg);
end;
$$;

-- Free confirm: explicit zero expected fee.
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
    expected_fee_minor = 0,
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
    jsonb_build_object('status', 'CONFIRMED', 'confirmed_free', true, 'expected_fee_minor', 0)
  );

  return v_reg;
end;
$$;

-- Attach to payment requires allotment and a positive fee (partners with 0 are not payable alone).
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
  if coalesce(v_reg.expected_fee_minor, 0) <= 0 then
    raise exception 'FEE_ZERO_NOT_ALLOWED';
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

create or replace function public.admin_attach_payment_participant(
  p_payment_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_norm extensions.citext;
  v_user public.users%rowtype;
  v_reg public.registrations%rowtype;
  v_amount int := 0;
  v_part_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.admin_can_edit_payment(v_pay.edition_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_pay.status in ('VERIFIED', 'CANCELLED') then
    raise exception 'PAYMENT_LOCKED';
  end if;

  v_norm := public.normalize_email(p_email);
  if v_norm is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  perform public.assert_email_free_for_payment(v_pay.edition_id, v_norm, v_pay.id);

  if exists (
    select 1 from public.payment_participants pp
    where pp.payment_id = v_pay.id
      and (
        pp.unmatched_email = v_norm
        or pp.user_id in (select u.id from public.users u where u.email = v_norm)
      )
  ) then
    raise exception 'DUPLICATE_EMAIL_IN_LIST';
  end if;

  select * into v_user
  from public.users
  where email = v_norm and deleted_at is null;
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
  if coalesce(v_reg.expected_fee_minor, 0) <= 0 then
    raise exception 'FEE_ZERO_NOT_ALLOWED';
  end if;

  v_amount := v_reg.expected_fee_minor;
  insert into public.payment_participants (
    payment_id, registration_id, user_id, unmatched_email, amount_minor
  ) values (
    v_pay.id, v_reg.id, v_user.id, v_norm, v_amount
  )
  returning id into v_part_id;

  perform public.recalculate_payment_expected(v_pay.id);

  perform public.write_audit(
    'payment.attach_participant',
    'payment_participants',
    v_part_id,
    null,
    jsonb_build_object('payment_id', v_pay.id, 'email', v_norm::text, 'amount_minor', v_amount)
  );

  return public.payment_payload(v_pay.id);
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
        and r.expected_fee_minor > 0
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
            and (
              pp.registration_id = r.id
              or pp.user_id = r.user_id
              or pp.unmatched_email = u.email
            )
        )
      order by u.full_name nulls last, u.email
      limit 20
    ) x
  );
end;
$$;

-- Phase change: bump unpaid allotted (non-outstation) fees to the new phase; open payments follow.
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

  -- Unpaid allotted paying leads/singles: adopt current phase fee.
  -- Skip outstation (fixed schedule), free-confirmed, locked payments, and double partners.
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

  -- Sync open payment lines and totals for refreshed registrations.
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

  -- Recalculate any open payments for the edition that still have participants.
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
    jsonb_build_object('edition_id', v_edition)
  );
end;
$$;

-- Super Admin only: confirm with attached proof; optional previous-phase amount override.
drop function if exists public.staff_confirm_payment_with_proof(uuid, text, text);

create or replace function public.staff_confirm_payment_with_proof(
  p_payment_id uuid,
  p_proof_image_key text,
  p_proof_sha256 text default null,
  p_confirm_amount_minor int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_pp public.payment_participants%rowtype;
  v_confirm int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_proof_image_key is null or btrim(p_proof_image_key) = '' then
    raise exception 'PROOF_REQUIRED';
  end if;
  if p_confirm_amount_minor is not null and p_confirm_amount_minor <= 0 then
    raise exception 'FEE_INVALID';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if v_pay.status = 'VERIFIED' then
    raise exception 'ALREADY_VERIFIED';
  end if;
  if v_pay.status not in ('UNDER_REVIEW', 'PENDING') then
    raise exception 'ALREADY_TERMINAL';
  end if;
  if not exists (select 1 from public.payment_participants where payment_id = v_pay.id) then
    raise exception 'NO_PARTICIPANTS';
  end if;

  v_confirm := p_confirm_amount_minor;

  update public.payments
  set
    proof_image_key = btrim(p_proof_image_key),
    proof_sha256 = nullif(btrim(coalesce(p_proof_sha256, '')), ''),
    status = 'UNDER_REVIEW',
    paid_at = coalesce(paid_at, now()),
    paid_amount_minor = coalesce(v_confirm, paid_amount_minor, expected_amount_minor),
    expected_amount_minor = coalesce(v_confirm, expected_amount_minor)
  where id = v_pay.id
  returning * into v_pay;

  -- When locking a previous-phase total, sync the single paying participant + registration fee.
  if v_confirm is not null then
    update public.payment_participants pp
    set amount_minor = v_confirm
    where pp.payment_id = v_pay.id
      and pp.id = (
        select pp2.id
        from public.payment_participants pp2
        where pp2.payment_id = v_pay.id
        order by pp2.amount_minor desc nulls last, pp2.created_at
        limit 1
      );

    update public.registrations r
    set expected_fee_minor = v_confirm
    from public.payment_participants pp
    where pp.payment_id = v_pay.id
      and pp.registration_id = r.id
      and pp.amount_minor = v_confirm
      and coalesce(r.is_pair_lead, true)
      and r.status in ('PAYMENT_PENDING', 'PAYMENT_REJECTED', 'SUBMITTED');
  end if;

  perform public.refresh_payment_amount_flag(v_pay.id);

  update public.payments
  set
    status = 'VERIFIED',
    verified_by = auth.uid(),
    verified_at = now()
  where id = v_pay.id
  returning * into v_pay;

  for v_pp in
    select * from public.payment_participants where payment_id = v_pay.id and registration_id is not null
  loop
    perform public.confirm_registration_from_payment(v_pp.registration_id);
  end loop;

  perform public.write_audit(
    'payment.staff_confirm_with_proof',
    'payments',
    v_pay.id,
    null,
    jsonb_build_object(
      'proof_image_key', p_proof_image_key,
      'confirm_amount_minor', v_confirm,
      'amount_flag', v_pay.amount_flag,
      'paid_amount_minor', v_pay.paid_amount_minor,
      'expected_amount_minor', v_pay.expected_amount_minor
    )
  );

  return public.payment_payload(v_pay.id);
end;
$$;

revoke all on function public.staff_confirm_payment_with_proof(uuid, text, text, int) from public;
grant execute on function public.staff_confirm_payment_with_proof(uuid, text, text, int) to authenticated, service_role;

notify pgrst, 'reload schema';
