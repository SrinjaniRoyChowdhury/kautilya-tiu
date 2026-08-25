-- Phase 5: attendance check-in/out, food collection, scan status (SRS FR-ATT / FR-FOOD)

drop function if exists public.validate_qr_token(text);

create or replace function public.resolve_scan_target(p_token text)
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
    'edition_id', v_reg.edition_id,
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

create or replace function public.validate_qr_token(
  p_token text,
  p_event_day integer default null,
  p_meal_schedule_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_target jsonb;
  v_att public.attendance%rowtype;
  v_food public.food_distribution%rowtype;
  v_meal text;
  v_day smallint;
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

  v_target := public.resolve_scan_target(p_token);

  if p_event_day is not null then
    if p_event_day not between 1 and 3 then
      raise exception 'INVALID_DAY';
    end if;
    select * into v_att
    from public.attendance
    where registration_id = (v_target->>'registration_id')::uuid
      and event_day = p_event_day;
  end if;

  if p_meal_schedule_id is not null then
    select mt.name, ms.event_day into v_meal, v_day
    from public.meal_schedules ms
    join public.meal_types mt on mt.id = ms.meal_type_id
    where ms.id = p_meal_schedule_id
      and ms.edition_id = (v_target->>'edition_id')::uuid;
    if not found then
      raise exception 'MEAL_NOT_FOUND';
    end if;
    select * into v_food
    from public.food_distribution
    where registration_id = (v_target->>'registration_id')::uuid
      and meal_schedule_id = p_meal_schedule_id;
  end if;

  return v_target || jsonb_build_object(
    'event_day', p_event_day,
    'checked_in_at', v_att.checked_in_at,
    'checked_out_at', v_att.checked_out_at,
    'meal_schedule_id', p_meal_schedule_id,
    'meal_name', v_meal,
    'meal_day', v_day,
    'collected_at', v_food.collected_at
  );
end;
$$;

create or replace function public.mark_attendance(p_token text, p_event_day integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target jsonb;
  v_reg_id uuid;
  v_edition uuid;
  v_att public.attendance%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_event_day is null or p_event_day not between 1 and 3 then
    raise exception 'INVALID_DAY';
  end if;

  v_target := public.resolve_scan_target(p_token);
  v_reg_id := (v_target->>'registration_id')::uuid;
  v_edition := (v_target->>'edition_id')::uuid;

  if not public.has_permission('attendance.scan', v_edition) then
    raise exception 'FORBIDDEN';
  end if;

  begin
    insert into public.attendance (registration_id, event_day, recorded_by, method)
    values (v_reg_id, p_event_day, auth.uid(), 'QR_SCAN')
    returning * into v_att;
  exception
    when unique_violation then
      select * into v_att
      from public.attendance
      where registration_id = v_reg_id and event_day = p_event_day;
      return v_target || jsonb_build_object(
        'already', true,
        'code', 'ALREADY_CHECKED_IN',
        'checked_in_at', v_att.checked_in_at,
        'checked_out_at', v_att.checked_out_at,
        'event_day', p_event_day
      );
  end;

  perform public.write_audit(
    'attendance.check_in',
    'attendance',
    v_att.id,
    null,
    jsonb_build_object('event_day', p_event_day, 'registration_id', v_reg_id)
  );

  return v_target || jsonb_build_object(
    'already', false,
    'checked_in_at', v_att.checked_in_at,
    'checked_out_at', v_att.checked_out_at,
    'event_day', p_event_day
  );
end;
$$;

create or replace function public.checkout_attendance(p_token text, p_event_day integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target jsonb;
  v_reg_id uuid;
  v_edition uuid;
  v_att public.attendance%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_event_day is null or p_event_day not between 1 and 3 then
    raise exception 'INVALID_DAY';
  end if;

  v_target := public.resolve_scan_target(p_token);
  v_reg_id := (v_target->>'registration_id')::uuid;
  v_edition := (v_target->>'edition_id')::uuid;
  if not public.has_permission('attendance.scan', v_edition) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_att
  from public.attendance
  where registration_id = v_reg_id and event_day = p_event_day
  for update;
  if not found then
    raise exception 'NOT_CHECKED_IN';
  end if;
  if v_att.checked_out_at is not null then
    return v_target || jsonb_build_object(
      'already', true,
      'code', 'ALREADY_CHECKED_OUT',
      'checked_in_at', v_att.checked_in_at,
      'checked_out_at', v_att.checked_out_at,
      'event_day', p_event_day
    );
  end if;

  update public.attendance
  set checked_out_at = now()
  where id = v_att.id
  returning * into v_att;

  perform public.write_audit(
    'attendance.check_out',
    'attendance',
    v_att.id,
    null,
    jsonb_build_object('event_day', p_event_day)
  );

  return v_target || jsonb_build_object(
    'already', false,
    'checked_in_at', v_att.checked_in_at,
    'checked_out_at', v_att.checked_out_at,
    'event_day', p_event_day
  );
end;
$$;

create or replace function public.collect_food(p_token text, p_meal_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target jsonb;
  v_reg_id uuid;
  v_edition uuid;
  v_sched public.meal_schedules%rowtype;
  v_meal text;
  v_row public.food_distribution%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_meal_schedule_id is null then
    raise exception 'MEAL_REQUIRED';
  end if;

  v_target := public.resolve_scan_target(p_token);
  v_reg_id := (v_target->>'registration_id')::uuid;
  v_edition := (v_target->>'edition_id')::uuid;
  if not public.has_permission('food.scan', v_edition) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_sched from public.meal_schedules where id = p_meal_schedule_id;
  if not found or v_sched.edition_id <> v_edition then
    raise exception 'MEAL_NOT_FOUND';
  end if;
  select name into v_meal from public.meal_types where id = v_sched.meal_type_id;

  begin
    insert into public.food_distribution (registration_id, meal_schedule_id, collected_by)
    values (v_reg_id, p_meal_schedule_id, auth.uid())
    returning * into v_row;
  exception
    when unique_violation then
      select * into v_row
      from public.food_distribution
      where registration_id = v_reg_id and meal_schedule_id = p_meal_schedule_id;
      return v_target || jsonb_build_object(
        'already', true,
        'code', 'ALREADY_COLLECTED',
        'collected_at', v_row.collected_at,
        'meal_schedule_id', p_meal_schedule_id,
        'meal_name', v_meal,
        'meal_day', v_sched.event_day
      );
  end;

  perform public.write_audit(
    'food.collect',
    'food_distribution',
    v_row.id,
    null,
    jsonb_build_object('meal_schedule_id', p_meal_schedule_id, 'registration_id', v_reg_id)
  );

  return v_target || jsonb_build_object(
    'already', false,
    'collected_at', v_row.collected_at,
    'meal_schedule_id', p_meal_schedule_id,
    'meal_name', v_meal,
    'meal_day', v_sched.event_day
  );
end;
$$;

create or replace function public.manual_attendance(
  p_registration_id uuid,
  p_event_day integer,
  p_reason text,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg public.registrations%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_mode text := upper(btrim(coalesce(p_mode, 'CHECK_IN')));
  v_att public.attendance%rowtype;
  v_old jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_event_day is null or p_event_day not between 1 and 3 then
    raise exception 'INVALID_DAY';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id and deleted_at is null
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.status <> 'CONFIRMED' then
    raise exception 'NOT_CONFIRMED';
  end if;
  if not public.has_permission('attendance.correct', v_reg.edition_id) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_att
  from public.attendance
  where registration_id = v_reg.id and event_day = p_event_day
  for update;

  if v_mode = 'VOID' then
    if not found then
      raise exception 'NOT_CHECKED_IN';
    end if;
    v_old := to_jsonb(v_att);
    delete from public.attendance where id = v_att.id;
    perform public.write_audit(
      'attendance.void',
      'attendance',
      v_att.id,
      v_old,
      jsonb_build_object('reason', v_reason, 'event_day', p_event_day)
    );
    return jsonb_build_object('ok', true, 'mode', 'VOID', 'event_day', p_event_day);
  end if;

  if v_mode = 'CHECK_OUT' then
    if not found then
      raise exception 'NOT_CHECKED_IN';
    end if;
    update public.attendance
    set
      checked_out_at = coalesce(checked_out_at, now()),
      notes = concat_ws(' | ', notes, v_reason)
    where id = v_att.id
    returning * into v_att;
    perform public.write_audit(
      'attendance.manual_checkout',
      'attendance',
      v_att.id,
      null,
      jsonb_build_object('reason', v_reason, 'event_day', p_event_day)
    );
    return jsonb_build_object(
      'ok', true,
      'mode', 'CHECK_OUT',
      'checked_in_at', v_att.checked_in_at,
      'checked_out_at', v_att.checked_out_at
    );
  end if;

  if found then
    raise exception 'ALREADY_CHECKED_IN';
  end if;

  insert into public.attendance (registration_id, event_day, recorded_by, method, notes)
  values (v_reg.id, p_event_day, auth.uid(), 'MANUAL', v_reason)
  returning * into v_att;

  perform public.write_audit(
    'attendance.manual_check_in',
    'attendance',
    v_att.id,
    null,
    jsonb_build_object('reason', v_reason, 'event_day', p_event_day)
  );

  return jsonb_build_object(
    'ok', true,
    'mode', 'CHECK_IN',
    'checked_in_at', v_att.checked_in_at,
    'event_day', p_event_day
  );
end;
$$;

revoke all on function public.resolve_scan_target(text) from public, anon, authenticated;
revoke all on function public.validate_qr_token(text, integer, uuid) from public;
revoke all on function public.mark_attendance(text, integer) from public;
revoke all on function public.checkout_attendance(text, integer) from public;
revoke all on function public.collect_food(text, uuid) from public;
revoke all on function public.manual_attendance(uuid, integer, text, text) from public;

grant execute on function public.validate_qr_token(text, integer, uuid) to anon, authenticated;
grant execute on function public.mark_attendance(text, integer) to anon, authenticated;
grant execute on function public.checkout_attendance(text, integer) to anon, authenticated;
grant execute on function public.collect_food(text, uuid) to anon, authenticated;
grant execute on function public.manual_attendance(uuid, integer, text, text) to authenticated;
