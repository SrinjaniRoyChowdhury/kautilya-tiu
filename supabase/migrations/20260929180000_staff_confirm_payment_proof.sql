-- Staff may attach a payment screenshot and confirm UNDER_REVIEW / PENDING payments.
-- Also harden verify_payment so a screenshot is always required.

create or replace function public.verify_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_pp public.payment_participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.has_permission('payment.verify', v_pay.edition_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_pay.status = 'VERIFIED' then
    raise exception 'ALREADY_VERIFIED';
  end if;
  if v_pay.status <> 'UNDER_REVIEW' then
    raise exception 'ALREADY_TERMINAL';
  end if;
  if v_pay.proof_image_key is null or btrim(v_pay.proof_image_key) = '' then
    raise exception 'PROOF_REQUIRED';
  end if;

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
    'payment.verify',
    'payments',
    v_pay.id,
    null,
    jsonb_build_object('amount_flag', v_pay.amount_flag, 'paid_amount_minor', v_pay.paid_amount_minor)
  );

  return public.payment_payload(v_pay.id);
end;
$$;

create or replace function public.staff_confirm_payment_with_proof(
  p_payment_id uuid,
  p_proof_image_key text,
  p_proof_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_pp public.payment_participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_proof_image_key is null or btrim(p_proof_image_key) = '' then
    raise exception 'PROOF_REQUIRED';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.has_permission('payment.verify', v_pay.edition_id) then
    raise exception 'FORBIDDEN';
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

  update public.payments
  set
    proof_image_key = btrim(p_proof_image_key),
    proof_sha256 = nullif(btrim(coalesce(p_proof_sha256, '')), ''),
    status = 'UNDER_REVIEW',
    paid_at = coalesce(paid_at, now()),
    paid_amount_minor = coalesce(paid_amount_minor, expected_amount_minor)
  where id = v_pay.id
  returning * into v_pay;

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
      'amount_flag', v_pay.amount_flag,
      'paid_amount_minor', v_pay.paid_amount_minor
    )
  );

  return public.payment_payload(v_pay.id);
end;
$$;

revoke all on function public.staff_confirm_payment_with_proof(uuid, text, text) from public;
grant execute on function public.staff_confirm_payment_with_proof(uuid, text, text) to authenticated;
