-- Admin payment participant edit + Delegate Affairs grants for payments/groups.

insert into public.permissions (code, description)
values
  ('payment.edit', 'Attach or detach delegates on payments before verification'),
  ('groups.manage', 'Create and edit collectives and institutions')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('payment.edit', 'groups.manage')
where r.name in ('SUPER_ADMIN', 'ADMIN', 'PAYMENT_ADMIN')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('payment.edit', 'groups.manage')
where r.name = 'DELEGATE_AFFAIRS'
on conflict do nothing;

-- Staff with payment.edit can mutate payment_participants (alongside payment.verify).
drop policy if exists payment_participants_mutate_staff on public.payment_participants;
create policy payment_participants_mutate_staff on public.payment_participants
  for all using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and (
          public.has_permission('payment.verify', p.edition_id)
          or public.has_permission('payment.edit', p.edition_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and (
          public.has_permission('payment.verify', p.edition_id)
          or public.has_permission('payment.edit', p.edition_id)
        )
    )
  );

drop policy if exists collectives_mutate on public.collectives;
create policy collectives_mutate on public.collectives
  for all using (
    public.has_permission('edition.manage')
    or public.has_permission('groups.manage')
  )
  with check (
    public.has_permission('edition.manage')
    or public.has_permission('groups.manage')
  );

drop policy if exists institutions_mutate on public.institutions;
create policy institutions_mutate on public.institutions
  for all using (
    public.has_permission('edition.manage')
    or public.has_permission('groups.manage')
  )
  with check (
    public.has_permission('edition.manage')
    or public.has_permission('groups.manage')
  );

create or replace function public.admin_can_edit_payment(p_edition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('payment.edit', p_edition_id)
      or public.has_permission('payment.verify', p_edition_id);
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

create or replace function public.admin_detach_payment_participant(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pp public.payment_participants%rowtype;
  v_pay public.payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_pp from public.payment_participants where id = p_participant_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select * into v_pay from public.payments where id = v_pp.payment_id for update;
  if not found or v_pay.deleted_at is not null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.admin_can_edit_payment(v_pay.edition_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_pay.status in ('VERIFIED', 'CANCELLED') then
    raise exception 'PAYMENT_LOCKED';
  end if;

  delete from public.payment_participants where id = v_pp.id;
  perform public.recalculate_payment_expected(v_pay.id);

  perform public.write_audit(
    'payment.detach_participant',
    'payment_participants',
    v_pp.id,
    jsonb_build_object(
      'payment_id', v_pay.id,
      'registration_id', v_pp.registration_id,
      'user_id', v_pp.user_id,
      'unmatched_email', v_pp.unmatched_email,
      'amount_minor', v_pp.amount_minor
    ),
    null
  );

  return public.payment_payload(v_pay.id);
end;
$$;

revoke all on function public.admin_can_edit_payment(uuid) from public;
revoke all on function public.admin_attach_payment_participant(uuid, text) from public;
revoke all on function public.admin_detach_payment_participant(uuid) from public;

grant execute on function public.admin_can_edit_payment(uuid) to authenticated, service_role;
grant execute on function public.admin_attach_payment_participant(uuid, text) to authenticated, service_role;
grant execute on function public.admin_detach_payment_participant(uuid) to authenticated, service_role;

-- Representatives may be set by staff with groups.manage (Delegate Affairs) as well as edition.manage.
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
  if not (
    public.has_permission('edition.manage', null)
    or public.has_permission('groups.manage', null)
  ) then
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
  if not (
    public.has_permission('edition.manage', null)
    or public.has_permission('groups.manage', null)
  ) then
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
