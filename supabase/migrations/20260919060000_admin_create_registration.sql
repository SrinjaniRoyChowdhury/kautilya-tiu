-- Additive only: creates one staff RPC. No table DDL, no data backfill, no drops of
-- existing objects. Safe to re-run (create or replace + idempotent grants).
-- Depends on existing helpers from earlier migrations:
--   has_permission, normalize_email, upsert_registration_values,
--   apply_delegation_pair, replace_registration_preferences, write_audit.
-- The whole body runs in a single transaction; any raised exception rolls back
-- the inserted registration (no half-created rows left behind).

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

  -- Lock any existing row for this user+edition so a concurrent self-serve
  -- start_registration cannot race past the uniqueness check.
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

  insert into public.registrations (
    edition_id,
    user_id,
    status,
    food_preference,
    delegation_type,
    is_pair_lead,
    collective_id,
    accepted_rules_at,
    submitted_at
  ) values (
    p_edition_id,
    v_user.id,
    'DRAFT',
    p_food_preference,
    v_type,
    true,
    p_collective_id,
    now(),
    now()
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
    accepted_rules_at = coalesce(accepted_rules_at, now())
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      status = case when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status else 'SUBMITTED' end,
      committee_id = null,
      expected_fee_minor = null
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
      'delegation_type', v_reg.delegation_type
    )
  );

  return to_jsonb(v_reg);
end;
$$;

revoke all on function public.admin_create_submitted_registration(
  uuid, text, public.food_preference, jsonb, public.delegation_type, text, jsonb, uuid
) from public;
grant execute on function public.admin_create_submitted_registration(
  uuid, text, public.food_preference, jsonb, public.delegation_type, text, jsonb, uuid
) to authenticated;

comment on function public.admin_create_submitted_registration(
  uuid, text, public.food_preference, jsonb, public.delegation_type, text, jsonb, uuid
) is
  'Staff (registration.edit): create SUBMITTED registration for an existing verified user. Additive RPC only.';
