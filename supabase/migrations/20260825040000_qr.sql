-- Phase 4: QR credential, regenerate, scanner validate (SRS FR-QR / §19)

insert into public.email_templates (edition_id, key, subject, body_html, editable)
select
  null,
  'QR_ISSUED',
  'Your Kautilya MUN credential — {{display_code}}',
  '<p>Dear {{full_name}},</p><p>You are confirmed for <strong>{{committee_name}}</strong>. Your credential code is <strong>{{display_code}}</strong>.</p><p>Show the attached QR at registration desks. The same QR is used all three days and for meals. Do not share it.</p><p>You can also open it any time in your dashboard: {{app_url}}/dashboard/qr</p>',
  true
where not exists (
  select 1 from public.email_templates t where t.key = 'QR_ISSUED' and t.edition_id is null
);

create or replace function public.regenerate_qr(p_registration_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_user public.users%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.qr_tokens%rowtype;
  v_new public.qr_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id and deleted_at is null
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if not public.has_permission('qr.regenerate', v_reg.edition_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_reg.status <> 'CONFIRMED' then
    raise exception 'NOT_CONFIRMED';
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
      revoked_reason = v_reason
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
    jsonb_build_object('registration_id', v_reg.id, 'display_code', v_new.display_code)
  );

  perform public.write_audit(
    'qr.regenerate',
    'qr_tokens',
    v_new.id,
    jsonb_build_object('old_id', v_old.id, 'old_display', v_old.display_code),
    jsonb_build_object('reason', v_reason, 'display_code', v_new.display_code)
  );

  return jsonb_build_object(
    'id', v_new.id,
    'registration_id', v_new.registration_id,
    'display_code', v_new.display_code,
    'status', v_new.status,
    'issued_at', v_new.issued_at
  );
end;
$$;

create or replace function public.validate_qr_token(p_token text)
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
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not (
    public.is_staff()
    or public.has_permission('attendance.scan')
    or public.has_permission('food.scan')
  ) then
    raise exception 'FORBIDDEN';
  end if;
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
    'full_name', v_user.full_name,
    'committee_short_name', v_comm.short_name,
    'committee_name', v_comm.name,
    'food_preference', v_reg.food_preference,
    'registration_status', v_reg.status,
    'display_code', v_qr.display_code,
    'issued_at', v_qr.issued_at
  );
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

  insert into public.email_logs (user_id, to_email, template_key, status)
  values (v_reg.user_id, v_user.email, 'QR_ISSUED', 'QUEUED');

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

create or replace function public.record_qr_email_result(
  p_registration_id uuid,
  p_delivered boolean,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_user public.users%rowtype;
  v_log_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id and deleted_at is null;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_reg.user_id <> auth.uid()
     and not public.is_staff()
     and not public.has_permission('payment.verify', v_reg.edition_id)
     and not public.has_permission('qr.regenerate', v_reg.edition_id) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_user from public.users where id = v_reg.user_id;

  select el.id into v_log_id
  from public.email_logs el
  where el.user_id = v_reg.user_id
    and el.template_key = 'QR_ISSUED'
    and el.status = 'QUEUED'
  order by el.created_at desc
  limit 1;

  if v_log_id is not null then
    update public.email_logs
    set
      status = case when p_delivered then 'SENT' else 'FAILED' end,
      error = case when p_delivered then null else left(coalesce(p_error, 'send failed'), 500) end,
      sent_at = case when p_delivered then now() else sent_at end
    where id = v_log_id;
  else
    insert into public.email_logs (user_id, to_email, template_key, status, error, sent_at)
    values (
      v_reg.user_id,
      v_user.email,
      'QR_ISSUED',
      case when p_delivered then 'SENT' else 'FAILED' end,
      case when p_delivered then null else left(coalesce(p_error, 'send failed'), 500) end,
      case when p_delivered then now() else null end
    );
  end if;
end;
$$;

revoke all on function public.regenerate_qr(uuid, text) from public;
revoke all on function public.validate_qr_token(text) from public;
revoke all on function public.record_qr_email_result(uuid, boolean, text) from public;
grant execute on function public.regenerate_qr(uuid, text) to authenticated;
grant execute on function public.validate_qr_token(text) to anon, authenticated;
grant execute on function public.record_qr_email_result(uuid, boolean, text) to authenticated;

drop policy if exists email_templates_select_auth on public.email_templates;
create policy email_templates_select_auth on public.email_templates
  for select using (auth.uid() is not null);
