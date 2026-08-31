-- Group representatives, institution FK on registrations, admin free confirmation.

alter table public.registrations
  add column if not exists institution_id uuid references public.institutions (id) on delete set null;

alter table public.registrations
  add column if not exists confirmed_free boolean not null default false;

create index if not exists registrations_institution_id_idx
  on public.registrations (institution_id)
  where institution_id is not null;

create index if not exists registrations_confirmed_free_idx
  on public.registrations (edition_id, confirmed_free)
  where confirmed_free = true and deleted_at is null;

create table if not exists public.group_representatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  collective_id uuid references public.collectives (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint group_rep_one_group check (
    (collective_id is not null and institution_id is null)
    or (collective_id is null and institution_id is not null)
  )
);

create unique index if not exists group_representatives_user_unique
  on public.group_representatives (user_id);

create unique index if not exists group_representatives_collective_unique
  on public.group_representatives (collective_id)
  where collective_id is not null;

create unique index if not exists group_representatives_institution_unique
  on public.group_representatives (institution_id)
  where institution_id is not null;

alter table public.group_representatives enable row level security;

drop policy if exists group_representatives_select on public.group_representatives;
create policy group_representatives_select on public.group_representatives
  for select using (
    auth.uid() = user_id
    or public.has_permission('edition.manage', null)
  );

drop policy if exists group_representatives_mutate on public.group_representatives;
create policy group_representatives_mutate on public.group_representatives
  for all using (public.has_permission('edition.manage', null))
  with check (public.has_permission('edition.manage', null));

grant select on public.group_representatives to authenticated, service_role;
grant insert, update, delete on public.group_representatives to authenticated, service_role;

create or replace function public.can_manage_group(p_collective_id uuid, p_institution_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.has_permission('edition.manage', null) then
    return true;
  end if;
  if p_collective_id is not null then
    return exists (
      select 1
      from public.group_representatives gr
      where gr.user_id = auth.uid()
        and gr.collective_id = p_collective_id
    );
  end if;
  if p_institution_id is not null then
    return exists (
      select 1
      from public.group_representatives gr
      where gr.user_id = auth.uid()
        and gr.institution_id = p_institution_id
    );
  end if;
  return false;
end;
$$;

create or replace function public.registration_has_verified_payment(p_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payment_participants pp
    join public.payments p on p.id = pp.payment_id
    where pp.registration_id = p_registration_id
      and p.deleted_at is null
      and p.status in ('VERIFIED', 'UNDER_REVIEW')
  );
$$;

create or replace function public.sync_institution_field_value(
  p_registration_id uuid,
  p_institution_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition_id uuid;
  v_field_id uuid;
begin
  select edition_id into v_edition_id
  from public.registrations
  where id = p_registration_id;

  select id into v_field_id
  from public.registration_field_definitions
  where edition_id = v_edition_id
    and field_key = 'institution'
  limit 1;

  if v_field_id is null then
    return;
  end if;

  perform public.upsert_registration_values(
    p_registration_id,
    jsonb_build_array(
      jsonb_build_object(
        'field_definition_id', v_field_id,
        'value_text', nullif(btrim(coalesce(p_institution_name, '')), ''),
        'value_json', null
      )
    )
  );
end;
$$;

create or replace function public.search_group_delegates(
  p_edition_id uuid,
  p_query text,
  p_collective_id uuid default null,
  p_institution_id uuid default null
)
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
  if not public.can_manage_group(p_collective_id, p_institution_id) then
    raise exception 'FORBIDDEN';
  end if;

  v_q := replace(replace(v_q, '%', '\%'), '_', '\_');

  return (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select
        r.id as registration_id,
        u.email::text as email,
        u.full_name,
        c.short_name as committee,
        r.status::text as status
      from public.registrations r
      join public.users u on u.id = r.user_id
      left join public.committees c on c.id = r.committee_id
      where r.edition_id = p_edition_id
        and r.deleted_at is null
        and r.status not in ('DRAFT', 'CANCELLED')
        and (
          u.email::text ilike ('%' || v_q || '%') escape '\'
          or u.full_name ilike ('%' || v_q || '%') escape '\'
        )
        and (
          p_collective_id is null
          or r.collective_id is distinct from p_collective_id
        )
        and (
          p_institution_id is null
          or r.institution_id is distinct from p_institution_id
        )
      order by u.email
      limit 15
    ) x
  );
end;
$$;

create or replace function public.assign_registration_collective(
  p_registration_id uuid,
  p_collective_id uuid
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
begin
  if p_collective_id is null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.can_manage_group(p_collective_id, null) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.status in ('DRAFT', 'CANCELLED') then
    raise exception 'NOT_REGISTERED';
  end if;
  if not exists (select 1 from public.collectives where id = p_collective_id) then
    raise exception 'NOT_FOUND';
  end if;

  update public.registrations
  set collective_id = p_collective_id
  where id = p_registration_id
  returning * into v_reg;

  perform public.write_audit(
    'registration.collective_assign',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object('collective_id', p_collective_id)
  );

  return v_reg;
end;
$$;

create or replace function public.assign_registration_institution(
  p_registration_id uuid,
  p_institution_id uuid
)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_name text;
begin
  if p_institution_id is null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.can_manage_group(null, p_institution_id) then
    raise exception 'FORBIDDEN';
  end if;

  select name into v_name
  from public.institutions
  where id = p_institution_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.status in ('DRAFT', 'CANCELLED') then
    raise exception 'NOT_REGISTERED';
  end if;

  update public.registrations
  set institution_id = p_institution_id
  where id = p_registration_id
  returning * into v_reg;

  perform public.sync_institution_field_value(v_reg.id, v_name);

  perform public.write_audit(
    'registration.institution_assign',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object('institution_id', p_institution_id)
  );

  return v_reg;
end;
$$;

create or replace function public.remove_registration_collective(p_registration_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
begin
  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.collective_id is null then
    return v_reg;
  end if;
  if not public.can_manage_group(v_reg.collective_id, null) then
    raise exception 'FORBIDDEN';
  end if;

  update public.registrations
  set collective_id = null
  where id = p_registration_id
  returning * into v_reg;

  perform public.write_audit(
    'registration.collective_remove',
    'registrations',
    v_reg.id,
    null,
    null
  );

  return v_reg;
end;
$$;

create or replace function public.remove_registration_institution(p_registration_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
begin
  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_reg.institution_id is null then
    return v_reg;
  end if;
  if not public.can_manage_group(null, v_reg.institution_id) then
    raise exception 'FORBIDDEN';
  end if;

  update public.registrations
  set institution_id = null
  where id = p_registration_id
  returning * into v_reg;

  perform public.sync_institution_field_value(v_reg.id, null);

  perform public.write_audit(
    'registration.institution_remove',
    'registrations',
    v_reg.id,
    null,
    null
  );

  return v_reg;
end;
$$;

create or replace function public.set_group_representative(
  p_user_id uuid,
  p_collective_id uuid default null,
  p_institution_id uuid default null
)
returns public.group_representatives
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.group_representatives%rowtype;
  v_reg public.registrations%rowtype;
begin
  if not public.has_permission('edition.manage', null) then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id is null then
    raise exception 'NOT_FOUND';
  end if;
  if (p_collective_id is null) = (p_institution_id is null) then
    raise exception 'INVALID_GROUP';
  end if;

  select * into v_reg
  from public.registrations r
  join public.mun_editions e on e.id = r.edition_id
  where r.user_id = p_user_id
    and r.deleted_at is null
    and r.status not in ('DRAFT', 'CANCELLED', 'CONFIRMED', 'PAYMENT_VERIFIED')
    and e.is_public_active = true
  order by r.submitted_at desc nulls last
  limit 1;

  if not found then
    raise exception 'NOT_ELIGIBLE';
  end if;
  if public.registration_has_verified_payment(v_reg.id) then
    raise exception 'ALREADY_PAID';
  end if;

  delete from public.group_representatives
  where collective_id = p_collective_id
     or institution_id = p_institution_id
     or user_id = p_user_id;

  insert into public.group_representatives (user_id, collective_id, institution_id)
  values (p_user_id, p_collective_id, p_institution_id)
  returning * into v_row;

  perform public.write_audit(
    'group.representative_set',
    'group_representatives',
    v_row.id,
    null,
    jsonb_build_object(
      'user_id', p_user_id,
      'collective_id', p_collective_id,
      'institution_id', p_institution_id
    )
  );

  return v_row;
end;
$$;

create or replace function public.clear_group_representative(
  p_collective_id uuid default null,
  p_institution_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('edition.manage', null) then
    raise exception 'FORBIDDEN';
  end if;
  if (p_collective_id is null) = (p_institution_id is null) then
    raise exception 'INVALID_GROUP';
  end if;

  delete from public.group_representatives
  where (p_collective_id is not null and collective_id = p_collective_id)
     or (p_institution_id is not null and institution_id = p_institution_id);

  perform public.write_audit(
    'group.representative_clear',
    'group_representatives',
    coalesce(p_collective_id, p_institution_id),
    null,
    null
  );
end;
$$;

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
    jsonb_build_object('status', 'CONFIRMED', 'confirmed_free', true)
  );

  return v_reg;
end;
$$;

revoke all on function public.can_manage_group(uuid, uuid) from public;
revoke all on function public.registration_has_verified_payment(uuid) from public;
revoke all on function public.sync_institution_field_value(uuid, text) from public;
revoke all on function public.search_group_delegates(uuid, text, uuid, uuid) from public;
revoke all on function public.assign_registration_collective(uuid, uuid) from public;
revoke all on function public.assign_registration_institution(uuid, uuid) from public;
revoke all on function public.remove_registration_collective(uuid) from public;
revoke all on function public.remove_registration_institution(uuid) from public;
revoke all on function public.set_group_representative(uuid, uuid, uuid) from public;
revoke all on function public.clear_group_representative(uuid, uuid) from public;
revoke all on function public.confirm_registration_free(uuid) from public;

grant execute on function public.search_group_delegates(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.assign_registration_collective(uuid, uuid) to authenticated;
grant execute on function public.assign_registration_institution(uuid, uuid) to authenticated;
grant execute on function public.remove_registration_collective(uuid) to authenticated;
grant execute on function public.remove_registration_institution(uuid) to authenticated;
grant execute on function public.set_group_representative(uuid, uuid, uuid) to authenticated;
grant execute on function public.clear_group_representative(uuid, uuid) to authenticated;
grant execute on function public.confirm_registration_free(uuid) to authenticated;

notify pgrst, 'reload schema';
