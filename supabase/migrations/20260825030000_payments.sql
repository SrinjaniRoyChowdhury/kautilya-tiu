-- Phase 3: manual UPI payments, group pay, admin verification (SRS FR-PAY / FR-GROUP-PAY / FR-PAYVER)

alter table public.payments
  add column if not exists proof_sha256 text;

create index if not exists payments_proof_sha256_idx
  on public.payments (proof_sha256)
  where proof_sha256 is not null;

-- Payers must not self-verify. Status changes go through security-definer RPCs.
drop policy if exists payments_update on public.payments;
create policy payments_update_staff on public.payments
  for update using (public.has_permission('payment.verify', edition_id))
  with check (public.has_permission('payment.verify', edition_id));

drop policy if exists payment_participants_mutate on public.payment_participants;
create policy payment_participants_mutate_staff on public.payment_participants
  for all using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and public.has_permission('payment.verify', p.edition_id)
    )
  )
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and public.has_permission('payment.verify', p.edition_id)
    )
  );

create or replace function public.can_view_payment(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.payments p
    where p.id = p_payment_id
      and (
        p.payer_user_id = auth.uid()
        or public.has_permission('payment.view', p.edition_id)
        or exists (
          select 1
          from public.payment_participants pp
          where pp.payment_id = p.id
            and (
              pp.user_id = auth.uid()
              or pp.unmatched_email = (select u.email from public.users u where u.id = auth.uid())
              or exists (
                select 1 from public.registrations r
                where r.id = pp.registration_id and r.user_id = auth.uid()
              )
            )
        )
      )
  );
$$;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (public.can_view_payment(id));

drop policy if exists payment_participants_select on public.payment_participants;
create policy payment_participants_select on public.payment_participants
  for select using (public.can_view_payment(payment_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_email(p_email text)
returns citext
language sql
immutable
set search_path = public, extensions
as $$
  select nullif(lower(btrim(coalesce(p_email, ''))), '')::citext;
$$;

create or replace function public.payment_blocks_email(p_status public.payment_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'VERIFIED');
$$;

create or replace function public.assert_email_free_for_payment(
  p_edition_id uuid,
  p_email citext,
  p_exclude_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if exists (
    select 1
    from public.payment_participants pp
    join public.payments p on p.id = pp.payment_id
    where p.edition_id = p_edition_id
      and p.deleted_at is null
      and p.id is distinct from p_exclude_payment_id
      and public.payment_blocks_email(p.status)
      and (
        pp.unmatched_email = p_email
        or pp.user_id in (select u.id from public.users u where u.email = p_email)
        or pp.registration_id in (
          select r.id
          from public.registrations r
          join public.users u on u.id = r.user_id
          where u.email = p_email
        )
      )
  ) then
    raise exception 'EMAIL_ALREADY_ON_ACTIVE_PAYMENT';
  end if;
end;
$$;

create or replace function public.refresh_payment_amount_flag(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_flag public.amount_flag;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then
    return;
  end if;
  if v_pay.paid_amount_minor is null then
    v_flag := 'UNKNOWN';
  elsif v_pay.paid_amount_minor < v_pay.expected_amount_minor then
    v_flag := 'UNDERPAID';
  elsif v_pay.paid_amount_minor > v_pay.expected_amount_minor then
    v_flag := 'OVERPAID';
  else
    v_flag := 'EXACT';
  end if;
  update public.payments set amount_flag = v_flag where id = p_payment_id;
end;
$$;

create or replace function public.recalculate_payment_expected(p_payment_id uuid)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_total int;
begin
  update public.payment_participants pp
  set amount_minor = coalesce(r.expected_fee_minor, 0)
  from public.registrations r
  where pp.payment_id = p_payment_id
    and pp.registration_id = r.id
    and r.expected_fee_minor is not null;

  select coalesce(sum(pp.amount_minor), 0)::int into v_total
  from public.payment_participants pp
  where pp.payment_id = p_payment_id;

  update public.payments
  set expected_amount_minor = v_total
  where id = p_payment_id;

  perform public.refresh_payment_amount_flag(p_payment_id);
  return v_total;
end;
$$;

create or replace function public.issue_qr_for_registration(p_registration_id uuid)
returns public.qr_tokens
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_year int;
  v_secret text;
  v_token public.qr_tokens%rowtype;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found or v_reg.status <> 'CONFIRMED' then
    raise exception 'NOT_CONFIRMED';
  end if;

  select * into v_token
  from public.qr_tokens
  where registration_id = p_registration_id and status = 'ACTIVE';
  if found then
    return v_token;
  end if;

  select e.year into v_year
  from public.mun_editions e
  where e.id = v_reg.edition_id;

  v_secret := encode(gen_random_bytes(16), 'hex');

  insert into public.qr_tokens (registration_id, token, display_code, status)
  values (
    p_registration_id,
    v_secret,
    'MUN' || right(coalesce(v_year, 2026)::text, 2) || '-' || upper(substr(v_secret, 1, 6)),
    'ACTIVE'
  )
  returning * into v_token;

  return v_token;
end;
$$;

create or replace function public.confirm_registration_from_payment(p_registration_id uuid)
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

  if v_reg.status in ('DRAFT', 'CANCELLED') then
    return v_reg;
  end if;

  if v_reg.status = 'CONFIRMED' then
    perform public.issue_qr_for_registration(v_reg.id);
    return v_reg;
  end if;

  update public.registrations
  set
    status = 'CONFIRMED',
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
    'Queued in-app. Phase 4 delivers the QR email; SMTP is out of v1 budget.'
  );

  insert into public.notifications (user_id, type, payload)
  values (
    v_reg.user_id,
    'registration.confirmed',
    jsonb_build_object('registration_id', v_reg.id, 'edition_id', v_reg.edition_id)
  );

  perform public.write_audit(
    'registration.confirm',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object('status', 'CONFIRMED')
  );

  return v_reg;
end;
$$;

create or replace function public.attach_email_to_payment(p_payment_id uuid, p_email citext)
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
      and (pp.unmatched_email = p_email or pp.user_id in (select u.id from public.users u where u.email = p_email))
  ) then
    raise exception 'DUPLICATE_EMAIL_IN_LIST';
  end if;

  select * into v_user
  from public.users
  where email = p_email and deleted_at is null;

  if found then
    select * into v_reg
    from public.registrations
    where user_id = v_user.id
      and edition_id = v_pay.edition_id
      and status <> 'CANCELLED'
      and deleted_at is null;

    if found and v_reg.status in ('PAYMENT_VERIFIED', 'CONFIRMED') then
      raise exception 'PAYMENT_ALREADY_VERIFIED';
    end if;

    if found and v_reg.status in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
      v_amount := coalesce(v_reg.expected_fee_minor, 0);
      insert into public.payment_participants (
        payment_id, registration_id, user_id, unmatched_email, amount_minor
      ) values (
        p_payment_id, v_reg.id, v_user.id, p_email, v_amount
      )
      returning id into v_part_id;
    else
      insert into public.payment_participants (
        payment_id, registration_id, user_id, unmatched_email, amount_minor
      ) values (
        p_payment_id, null, v_user.id, p_email, 0
      )
      returning id into v_part_id;
    end if;
  else
    insert into public.payment_participants (
      payment_id, registration_id, user_id, unmatched_email, amount_minor
    ) values (
      p_payment_id, null, null, p_email, 0
    )
    returning id into v_part_id;
  end if;

  perform public.recalculate_payment_expected(p_payment_id);
  return v_part_id;
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
  v_email citext;
  v_pay_id uuid;
begin
  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    return;
  end if;
  if v_reg.status not in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
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
    and pp.registration_id is null
    and (
      pp.user_id = v_reg.user_id
      or pp.unmatched_email = v_email
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

create or replace function public.link_user_to_unmatched_payments(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email citext;
  v_reg public.registrations%rowtype;
begin
  select email into v_email from public.users where id = p_user_id;
  if v_email is null then
    return;
  end if;

  update public.payment_participants pp
  set user_id = p_user_id
  from public.payments p
  where pp.payment_id = p.id
    and p.deleted_at is null
    and public.payment_blocks_email(p.status)
    and pp.user_id is null
    and pp.unmatched_email = v_email;

  for v_reg in
    select r.*
    from public.registrations r
    where r.user_id = p_user_id
      and r.deleted_at is null
      and r.status <> 'CANCELLED'
  loop
    perform public.link_registration_to_payments(v_reg.id);
  end loop;
end;
$$;

create or replace function public.payment_payload(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_pay jsonb;
  v_parts jsonb;
begin
  select to_jsonb(p) into v_pay from public.payments p where p.id = p_payment_id;
  select coalesce(jsonb_agg(to_jsonb(pp) order by pp.created_at), '[]'::jsonb)
    into v_parts
  from public.payment_participants pp
  where pp.payment_id = p_payment_id;
  return jsonb_build_object('payment', v_pay, 'participants', v_parts);
end;
$$;

-- ---------------------------------------------------------------------------
-- Participant RPCs
-- ---------------------------------------------------------------------------

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
  v_email citext;
  v_item text;
  v_seen citext[] := '{}';
  v_norm citext;
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

create or replace function public.add_payment_emails(p_payment_id uuid, p_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_pay public.payments%rowtype;
  v_item text;
  v_norm citext;
begin
  perform public.ensure_email_verified();
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.payer_user_id <> v_user or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  foreach v_item in array coalesce(p_emails, '{}')
  loop
    v_norm := public.normalize_email(v_item);
    if v_norm is null then
      continue;
    end if;
    perform public.attach_email_to_payment(v_pay.id, v_norm);
  end loop;
  return public.payment_payload(v_pay.id);
end;
$$;

create or replace function public.correct_unmatched_email(
  p_participant_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_pp public.payment_participants%rowtype;
  v_pay public.payments%rowtype;
  v_norm citext;
begin
  perform public.ensure_email_verified();
  v_norm := public.normalize_email(p_email);
  if v_norm is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select * into v_pp from public.payment_participants where id = p_participant_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_pay from public.payments where id = v_pp.payment_id for update;
  if v_pay.payer_user_id <> v_user then
    raise exception 'NOT_FOUND';
  end if;
  if v_pp.registration_id is not null then
    raise exception 'PAYMENT_LOCKED';
  end if;
  if v_pay.status not in ('DRAFT', 'PENDING', 'REJECTED') then
    raise exception 'PAYMENT_LOCKED';
  end if;

  delete from public.payment_participants where id = v_pp.id;
  perform public.attach_email_to_payment(v_pay.id, v_norm);
  perform public.write_audit(
    'payment.correct_email',
    'payment_participants',
    v_pp.id,
    jsonb_build_object('unmatched_email', v_pp.unmatched_email),
    jsonb_build_object('unmatched_email', v_norm)
  );
  return public.payment_payload(v_pay.id);
end;
$$;

create or replace function public.submit_payment_proof(
  p_payment_id uuid,
  p_proof_image_key text,
  p_paid_amount_minor int,
  p_transaction_ref text,
  p_paid_at timestamptz,
  p_proof_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_pay public.payments%rowtype;
  v_dup uuid[];
begin
  perform public.ensure_email_verified();

  if p_proof_image_key is null or btrim(p_proof_image_key) = '' then
    raise exception 'PROOF_REQUIRED';
  end if;
  if p_paid_amount_minor is null or p_paid_amount_minor <= 0 then
    raise exception 'AMOUNT_REQUIRED';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.payer_user_id <> v_user or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if v_pay.status = 'VERIFIED' then
    raise exception 'ALREADY_VERIFIED';
  end if;
  if v_pay.status = 'CANCELLED' then
    raise exception 'ALREADY_TERMINAL';
  end if;
  if v_pay.status = 'UNDER_REVIEW' then
    raise exception 'ALREADY_SUBMITTED';
  end if;
  if v_pay.status not in ('DRAFT', 'PENDING', 'REJECTED') then
    raise exception 'PAYMENT_LOCKED';
  end if;
  if not exists (select 1 from public.payment_participants where payment_id = v_pay.id) then
    raise exception 'NO_PARTICIPANTS';
  end if;

  perform public.recalculate_payment_expected(v_pay.id);

  select coalesce(array_agg(p.id), '{}') into v_dup
  from public.payments p
  where p.proof_sha256 = p_proof_sha256
    and p.id <> v_pay.id
    and p.deleted_at is null
    and p_proof_sha256 is not null;

  update public.payments
  set
    proof_image_key = p_proof_image_key,
    paid_amount_minor = p_paid_amount_minor,
    transaction_ref = nullif(btrim(coalesce(p_transaction_ref, '')), ''),
    paid_at = coalesce(p_paid_at, now()),
    proof_sha256 = p_proof_sha256,
    status = 'UNDER_REVIEW'
  where id = v_pay.id
  returning * into v_pay;

  perform public.refresh_payment_amount_flag(v_pay.id);

  perform public.write_audit(
    'payment.submit_proof',
    'payments',
    v_pay.id,
    null,
    jsonb_build_object(
      'paid_amount_minor', p_paid_amount_minor,
      'expected_amount_minor', v_pay.expected_amount_minor,
      'proof_image_key', p_proof_image_key
    )
  );

  return public.payment_payload(v_pay.id) || jsonb_build_object('duplicate_payment_ids', to_jsonb(v_dup));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

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

create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pay public.payments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_previous text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.has_permission('payment.verify', v_pay.edition_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_pay.status in ('VERIFIED', 'REJECTED', 'CANCELLED') then
    raise exception 'ALREADY_TERMINAL';
  end if;

  v_previous := v_pay.rejection_reason;

  update public.payments
  set
    status = 'REJECTED',
    rejection_reason = v_reason,
    verified_by = auth.uid(),
    verified_at = now()
  where id = v_pay.id
  returning * into v_pay;

  update public.registrations r
  set status = 'PAYMENT_REJECTED'
  from public.payment_participants pp
  where pp.payment_id = v_pay.id
    and pp.registration_id = r.id
    and r.status in ('SUBMITTED', 'PAYMENT_PENDING')
    and r.deleted_at is null;

  perform public.write_audit(
    'payment.reject',
    'payments',
    v_pay.id,
    jsonb_build_object('previous_reason', v_previous),
    jsonb_build_object('reason', v_reason)
  );

  return public.payment_payload(v_pay.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hooks into auth + registration
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.users (id, email, full_name, phone, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email_confirmed_at
  );
  if new.email_confirmed_at is not null then
    perform public.link_user_to_unmatched_payments(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.sync_user_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.users
  set email_verified_at = new.email_confirmed_at,
      email = new.email,
      updated_at = now()
  where id = new.id;
  if new.email_confirmed_at is not null then
    perform public.link_user_to_unmatched_payments(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.registration_payment_locked(p_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.payment_participants pp
    join public.payments p on p.id = pp.payment_id
    where pp.registration_id = p_registration_id
      and p.deleted_at is null
      and p.status in ('UNDER_REVIEW', 'VERIFIED')
  );
$$;

create or replace function public.save_registration_draft(
  p_registration_id uuid,
  p_committee_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb
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
    food_preference = p_food_preference
  where id = v_reg.id
  returning * into v_reg;

  return to_jsonb(v_reg);
end;
$$;

create or replace function public.submit_registration(
  p_registration_id uuid,
  p_committee_id uuid,
  p_food_preference public.food_preference,
  p_values jsonb
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

  if v_reg.status not in ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  select * into v_edition
  from public.mun_editions
  where id = v_reg.edition_id;

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

  select count(*)::int into v_taken
  from public.registrations
  where committee_id = v_committee.id
    and deleted_at is null
    and status not in ('DRAFT', 'CANCELLED')
    and id <> v_reg.id;

  if v_taken >= v_committee.capacity then
    raise exception 'COMMITTEE_FULL';
  end if;

  perform public.upsert_registration_values(v_reg.id, p_values);

  update public.registrations
  set
    committee_id = v_committee.id,
    food_preference = p_food_preference,
    expected_fee_minor = v_committee.fee_minor,
    status = 'PAYMENT_PENDING',
    submitted_at = coalesce(v_reg.submitted_at, now())
  where id = v_reg.id
  returning * into v_reg;

  perform public.link_registration_to_payments(v_reg.id);
  select * into v_reg from public.registrations where id = v_reg.id;

  perform public.write_audit(
    'registration.submit',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'committee_id', v_committee.id,
      'expected_fee_minor', v_committee.fee_minor
    )
  );

  return to_jsonb(v_reg);
end;
$$;

revoke all on function public.registration_payment_locked(uuid) from public;
revoke all on function public.can_view_payment(uuid) from public;
revoke all on function public.normalize_email(text) from public;
revoke all on function public.payment_blocks_email(public.payment_status) from public;
revoke all on function public.assert_email_free_for_payment(uuid, citext, uuid) from public;
revoke all on function public.refresh_payment_amount_flag(uuid) from public;
revoke all on function public.recalculate_payment_expected(uuid) from public;
revoke all on function public.issue_qr_for_registration(uuid) from public;
revoke all on function public.confirm_registration_from_payment(uuid) from public;
revoke all on function public.attach_email_to_payment(uuid, citext) from public;
revoke all on function public.link_registration_to_payments(uuid) from public;
revoke all on function public.link_user_to_unmatched_payments(uuid) from public;
revoke all on function public.payment_payload(uuid) from public;
revoke all on function public.start_or_get_payment(uuid, text[], boolean) from public;
revoke all on function public.add_payment_emails(uuid, text[]) from public;
revoke all on function public.correct_unmatched_email(uuid, text) from public;
revoke all on function public.submit_payment_proof(uuid, text, int, text, timestamptz, text) from public;
revoke all on function public.verify_payment(uuid) from public;
revoke all on function public.reject_payment(uuid, text) from public;

grant execute on function public.can_view_payment(uuid) to anon, authenticated;
grant execute on function public.start_or_get_payment(uuid, text[], boolean) to authenticated;
grant execute on function public.add_payment_emails(uuid, text[]) to authenticated;
grant execute on function public.correct_unmatched_email(uuid, text) to authenticated;
grant execute on function public.submit_payment_proof(uuid, text, int, text, timestamptz, text) to authenticated;
grant execute on function public.verify_payment(uuid) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.payment_payload(uuid) to authenticated;
