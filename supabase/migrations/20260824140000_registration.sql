-- Phase 2: registration RPCs with committee capacity locking (SRS FR-REG, FR-COMM-002/003, §34)

create or replace function public.edition_committee_occupancy(p_edition_id uuid)
returns table (committee_id uuid, seats_taken int)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    count(r.id)::int as seats_taken
  from public.committees c
  left join public.registrations r
    on r.committee_id = c.id
    and r.deleted_at is null
    and r.status not in ('DRAFT', 'CANCELLED')
  where c.edition_id = p_edition_id
    and c.deleted_at is null
  group by c.id;
$$;

create or replace function public.ensure_email_verified()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.status = 'ACTIVE'
      and u.email_verified_at is not null
  ) then
    raise exception 'EMAIL_UNVERIFIED';
  end if;
end;
$$;

create or replace function public.assert_registration_window(p_edition public.mun_editions)
returns void
language plpgsql
stable
as $$
begin
  if p_edition.status <> 'PUBLISHED' or p_edition.deleted_at is not null then
    raise exception 'EDITION_NOT_OPEN';
  end if;
  if p_edition.registration_open_at is not null and now() < p_edition.registration_open_at then
    raise exception 'REGISTRATION_NOT_OPEN';
  end if;
  if p_edition.registration_close_at is not null and now() > p_edition.registration_close_at then
    raise exception 'REGISTRATION_CLOSED';
  end if;
end;
$$;

create or replace function public.upsert_registration_values(
  p_registration_id uuid,
  p_values jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_values, '[]'::jsonb))
  loop
    insert into public.registration_field_values (
      registration_id, field_definition_id, value_text, value_json
    ) values (
      p_registration_id,
      (v_item->>'field_definition_id')::uuid,
      nullif(v_item->>'value_text', ''),
      case
        when v_item->'value_json' is null or v_item->>'value_json' = 'null' then null
        else v_item->'value_json'
      end
    )
    on conflict (registration_id, field_definition_id)
    do update set
      value_text = excluded.value_text,
      value_json = excluded.value_json,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.start_registration(p_edition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_edition public.mun_editions%rowtype;
  v_reg public.registrations%rowtype;
begin
  perform public.ensure_email_verified();

  select * into v_edition
  from public.mun_editions
  where id = p_edition_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if not v_edition.is_public_active then
    raise exception 'EDITION_NOT_OPEN';
  end if;
  perform public.assert_registration_window(v_edition);

  select * into v_reg
  from public.registrations
  where edition_id = p_edition_id
    and user_id = v_user
    and status <> 'CANCELLED'
    and deleted_at is null;

  if found then
    return to_jsonb(v_reg);
  end if;

  insert into public.registrations (edition_id, user_id, status)
  values (p_edition_id, v_user, 'DRAFT')
  returning * into v_reg;

  perform public.write_audit(
    'registration.start',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object('edition_id', p_edition_id)
  );

  return to_jsonb(v_reg);
exception
  when unique_violation then
    raise exception 'ALREADY_REGISTERED';
end;
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
set search_path = public
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
set search_path = public
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

  select * into v_edition
  from public.mun_editions
  where id = v_reg.edition_id;

  perform public.assert_registration_window(v_edition);

  -- Row lock: two concurrent submits cannot both pass the last seat (SRS §34 / 55.2).
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

revoke all on function public.edition_committee_occupancy(uuid) from public;
revoke all on function public.start_registration(uuid) from public;
revoke all on function public.save_registration_draft(uuid, uuid, public.food_preference, jsonb) from public;
revoke all on function public.submit_registration(uuid, uuid, public.food_preference, jsonb) from public;
revoke all on function public.ensure_email_verified() from public;
revoke all on function public.assert_registration_window(public.mun_editions) from public;
revoke all on function public.upsert_registration_values(uuid, jsonb) from public;

grant execute on function public.edition_committee_occupancy(uuid) to anon, authenticated;
grant execute on function public.start_registration(uuid) to authenticated;
grant execute on function public.save_registration_draft(uuid, uuid, public.food_preference, jsonb) to authenticated;
grant execute on function public.submit_registration(uuid, uuid, public.food_preference, jsonb) to authenticated;
