-- Staff (admin / Delegate Affairs) may:
-- 1) Record a separate/offline payment for one registration → revenue + confirm + QR
-- 2) Change committee + portfolio after payment (double del syncs partner) → regenerate QR

create or replace function public.can_staff_record_registration_payment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_delegate_affairs()
    or public.has_permission('payment.verify');
$$;

revoke all on function public.can_staff_record_registration_payment() from public;
grant execute on function public.can_staff_record_registration_payment() to authenticated, service_role;

-- Internal: revoke active QR and issue a new one (no permission check; caller is staff RPC).
create or replace function public.regenerate_qr_internal(
  p_registration_id uuid,
  p_reason text
)
returns public.qr_tokens
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_old public.qr_tokens%rowtype;
  v_new public.qr_tokens%rowtype;
  v_user public.users%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_reg
  from public.registrations
  where id = p_registration_id and deleted_at is null
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.status <> 'CONFIRMED' then
    return null;
  end if;

  select * into v_old
  from public.qr_tokens
  where registration_id = v_reg.id and status = 'ACTIVE'
  for update;

  if found then
    update public.qr_tokens
    set
      status = 'REVOKED',
      revoked_at = now(),
      revoked_reason = coalesce(nullif(v_reason, ''), 'Allotment changed')
    where id = v_old.id;
  end if;

  select * into v_new from public.issue_qr_for_registration(v_reg.id);
  select * into v_user from public.users where id = v_reg.user_id;

  insert into public.email_logs (user_id, to_email, template_key, status)
  values (v_reg.user_id, v_user.email, 'QR_ISSUED', 'QUEUED');

  insert into public.notifications (user_id, type, payload)
  values (
    v_reg.user_id,
    'qr.regenerated',
    jsonb_build_object(
      'registration_id', v_reg.id,
      'display_code', v_new.display_code,
      'reason', coalesce(nullif(v_reason, ''), 'Allotment changed')
    )
  );

  perform public.write_audit(
    'qr.regenerate',
    'qr_tokens',
    v_new.id,
    jsonb_build_object('old_id', v_old.id, 'old_display', v_old.display_code),
    jsonb_build_object(
      'reason', coalesce(nullif(v_reason, ''), 'Allotment changed'),
      'display_code', v_new.display_code,
      'auto', true
    )
  );

  return v_new;
end;
$$;

revoke all on function public.regenerate_qr_internal(uuid, text) from public;
grant execute on function public.regenerate_qr_internal(uuid, text) to service_role;

-- Record offline / separate payment for one allotted registration.
create or replace function public.staff_record_registration_payment(
  p_registration_id uuid,
  p_amount_minor int,
  p_reason text,
  p_proof_image_key text default null,
  p_proof_sha256 text default null,
  p_transaction_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_partner public.registrations%rowtype;
  v_pay public.payments%rowtype;
  v_email extensions.citext;
  v_amount int;
  v_reason text;
  v_open uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.can_staff_record_registration_payment() then
    raise exception 'FORBIDDEN';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'FEE_INVALID';
  end if;
  v_amount := p_amount_minor;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_reg.status in ('DRAFT', 'CANCELLED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  if v_reg.committee_id is null then
    raise exception 'ALLOCATION_REQUIRED';
  end if;

  if coalesce(v_reg.confirmed_free, false) then
    raise exception 'ALREADY_FREE';
  end if;

  if v_reg.status in ('CONFIRMED', 'PAYMENT_VERIFIED')
     or public.registration_has_verified_payment(v_reg.id) then
    raise exception 'ALREADY_PAID';
  end if;

  -- Block if a payment covering this reg is already under review (verify that instead).
  select p.id into v_open
  from public.payment_participants pp
  join public.payments p on p.id = pp.payment_id
  where pp.registration_id = v_reg.id
    and p.deleted_at is null
    and p.status = 'UNDER_REVIEW'
  limit 1;
  if v_open is not null then
    raise exception 'PAYMENT_UNDER_REVIEW';
  end if;

  select email into v_email from public.users where id = v_reg.user_id;

  insert into public.payments (
    edition_id,
    payer_user_id,
    expected_amount_minor,
    paid_amount_minor,
    status,
    amount_flag,
    proof_image_key,
    proof_sha256,
    transaction_ref,
    paid_at,
    verified_by,
    verified_at
  ) values (
    v_reg.edition_id,
    v_reg.user_id,
    v_amount,
    v_amount,
    'VERIFIED',
    'EXACT',
    nullif(btrim(coalesce(p_proof_image_key, '')), ''),
    nullif(btrim(coalesce(p_proof_sha256, '')), ''),
    nullif(btrim(coalesce(p_transaction_ref, '')), ''),
    now(),
    auth.uid(),
    now()
  )
  returning * into v_pay;

  insert into public.payment_participants (
    payment_id, registration_id, user_id, unmatched_email, amount_minor
  ) values (
    v_pay.id, v_reg.id, v_reg.user_id, v_email, v_amount
  );

  -- Keep registration expected fee in sync with what was recorded.
  update public.registrations
  set expected_fee_minor = v_amount
  where id = v_reg.id
    and coalesce(is_pair_lead, true);

  perform public.confirm_registration_from_payment(v_reg.id);

  -- Double del: lead payment covers the pair — confirm partner credentials too.
  if v_reg.partner_registration_id is not null
     and coalesce(v_reg.is_pair_lead, true) then
    select * into v_partner
    from public.registrations
    where id = v_reg.partner_registration_id
      and deleted_at is null
      and status not in ('CANCELLED');
    if found and v_partner.status not in ('CONFIRMED') then
      perform public.confirm_registration_from_payment(v_partner.id);
    end if;
  end if;

  perform public.write_audit(
    'payment.staff_record_registration',
    'payments',
    v_pay.id,
    null,
    jsonb_build_object(
      'registration_id', v_reg.id,
      'amount_minor', v_amount,
      'reason', v_reason,
      'transaction_ref', nullif(btrim(coalesce(p_transaction_ref, '')), ''),
      'proof_image_key', nullif(btrim(coalesce(p_proof_image_key, '')), '')
    )
  );

  return jsonb_build_object(
    'payment_id', v_pay.id,
    'registration_id', v_reg.id,
    'paid_amount_minor', v_amount,
    'partner_registration_id', v_reg.partner_registration_id
  );
end;
$$;

revoke all on function public.staff_record_registration_payment(uuid, int, text, text, text, text) from public;
grant execute on function public.staff_record_registration_payment(uuid, int, text, text, text, text) to authenticated, service_role;

-- Change committee and/or portfolio after payment; sync double partner; regenerate QRs.
create or replace function public.reallocate_allotment_after_payment(
  p_registration_id uuid,
  p_committee_id uuid,
  p_portfolio text,
  p_reason text,
  p_slr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_partner public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_portfolio text;
  v_slr int;
  v_old_committee uuid;
  v_old_portfolio text;
  v_old_slr int;
  v_reason text;
  v_taken int;
  v_ids uuid[];
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.can_reallocate_portfolio_after_payment() then
    raise exception 'FORBIDDEN';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not (
    v_reg.status in ('PAYMENT_VERIFIED', 'CONFIRMED')
    or public.registration_has_verified_payment(v_reg.id)
  ) then
    raise exception 'NOT_PAID';
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
  if coalesce(v_reg.delegation_type, 'SINGLE') = 'SINGLE'
     and not coalesce(v_committee.allows_single_del, true) then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;

  v_portfolio := nullif(btrim(coalesce(p_portfolio, '')), '');
  if v_portfolio is null and not coalesce(v_committee.is_special_crisis, false) then
    raise exception 'PORTFOLIO_REQUIRED';
  end if;

  -- Capacity when moving to a different committee (pair counts as one seat).
  if v_reg.committee_id is distinct from p_committee_id then
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
  end if;

  v_old_committee := v_reg.committee_id;
  v_old_portfolio := v_reg.allocated_portfolio;
  v_old_slr := v_reg.allocated_slr;
  v_slr := p_slr;

  if v_slr is not null then
    update public.registrations
    set allocated_slr = null
    where committee_id = v_committee.id
      and allocated_slr = v_slr
      and id is distinct from v_reg.id
      and (v_reg.partner_registration_id is null or id is distinct from v_reg.partner_registration_id);
  end if;

  update public.registrations
  set
    committee_id = v_committee.id,
    allocated_portfolio = v_portfolio,
    allocated_slr = v_slr
  where id = v_reg.id
  returning * into v_reg;

  v_ids := array[v_reg.id];

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      committee_id = v_committee.id,
      allocated_portfolio = v_portfolio,
      allocated_slr = v_slr
    where id = v_reg.partner_registration_id
      and deleted_at is null
      and status not in ('CANCELLED')
    returning * into v_partner;

    if found then
      v_ids := array_append(v_ids, v_partner.id);
    end if;
  end if;

  -- Regenerate credentials so codes / emails reflect the new allotment.
  foreach v_id in array v_ids
  loop
    perform public.regenerate_qr_internal(v_id, v_reason);
  end loop;

  perform public.write_audit(
    'registration.reallocate_allotment',
    'registrations',
    v_reg.id,
    jsonb_build_object(
      'committee_id', v_old_committee,
      'allocated_portfolio', v_old_portfolio,
      'allocated_slr', v_old_slr
    ),
    jsonb_build_object(
      'committee_id', v_committee.id,
      'allocated_portfolio', v_portfolio,
      'allocated_slr', v_slr,
      'reason', v_reason,
      'partner_registration_id', v_reg.partner_registration_id
    )
  );

  return to_jsonb(v_reg) || jsonb_build_object(
    'regenerated_registration_ids', to_jsonb(v_ids)
  );
end;
$$;

revoke all on function public.reallocate_allotment_after_payment(uuid, uuid, text, text, int) from public;
grant execute on function public.reallocate_allotment_after_payment(uuid, uuid, text, text, int) to authenticated, service_role;

-- Keep old portfolio-only RPC as a thin wrapper (existing clients).
create or replace function public.reallocate_portfolio_after_payment(
  p_registration_id uuid,
  p_portfolio text,
  p_reason text,
  p_slr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_committee_id uuid;
begin
  select committee_id into v_committee_id
  from public.registrations
  where id = p_registration_id
    and deleted_at is null;
  if v_committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
  end if;
  return public.reallocate_allotment_after_payment(
    p_registration_id,
    v_committee_id,
    p_portfolio,
    p_reason,
    p_slr
  );
end;
$$;

notify pgrst, 'reload schema';
