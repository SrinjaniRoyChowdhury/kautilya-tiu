-- Scanner logins: only attendance.scan / food.scan may validate QR. Admins may create desk operators.

create or replace function public.has_scan_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code in ('attendance.scan', 'food.scan')
  );
$$;

revoke all on function public.has_scan_access() from public;
grant execute on function public.has_scan_access() to authenticated;

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
  v_edition uuid;
  v_att public.attendance%rowtype;
  v_food public.food_distribution%rowtype;
  v_meal text;
  v_day smallint;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_target := public.resolve_scan_target(p_token);
  v_edition := (v_target->>'edition_id')::uuid;
  if not (
    public.has_permission('attendance.scan', v_edition)
    or public.has_permission('food.scan', v_edition)
  ) then
    raise exception 'FORBIDDEN';
  end if;

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
      and ms.edition_id = v_edition;
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

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'users.manage'
where r.name = 'ADMIN'
on conflict do nothing;
