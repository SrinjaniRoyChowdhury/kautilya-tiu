-- Outstation delegates: student type, optional college accommodation+meal, check-in slot.
-- Admin can set expected_fee_minor manually when allocating outstation registrations.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'outstation_student_type') then
    create type public.outstation_student_type as enum ('SCHOOL', 'COLLEGE');
  end if;
  if not exists (select 1 from pg_type where typname = 'outstation_check_in') then
    create type public.outstation_check_in as enum ('NOV_26_NIGHT', 'NOV_27_MORNING');
  end if;
end $$;

alter table public.registrations
  add column if not exists is_outstation boolean not null default false,
  add column if not exists outstation_student_type public.outstation_student_type,
  add column if not exists outstation_needs_accommodation boolean not null default false,
  add column if not exists outstation_check_in public.outstation_check_in;

alter table public.registrations
  drop constraint if exists registrations_outstation_chk;

alter table public.registrations
  add constraint registrations_outstation_chk check (
    (
      is_outstation = false
      and outstation_student_type is null
      and outstation_needs_accommodation = false
      and outstation_check_in is null
    )
    or (
      is_outstation = true
      and (
        outstation_student_type is null
        or outstation_student_type = 'SCHOOL'
        or outstation_student_type = 'COLLEGE'
      )
      and (
        outstation_student_type is distinct from 'SCHOOL'
        or (
          outstation_needs_accommodation = false
          and outstation_check_in is null
        )
      )
      and (
        outstation_check_in is null
        or outstation_needs_accommodation = true
      )
    )
  );

create index if not exists registrations_outstation_idx
  on public.registrations (edition_id, is_outstation)
  where deleted_at is null and is_outstation = true;

drop function if exists public.allocate_registration(uuid, uuid, text, int);
drop function if exists public.allocate_registration(uuid, uuid, text, int, int);

create or replace function public.allocate_registration(
  p_registration_id uuid,
  p_committee_id uuid,
  p_portfolio text,
  p_slr int default null,
  p_expected_fee_minor int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_taken int;
  v_slr int;
  v_portfolio text;
  v_fee int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

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

  if v_reg.status not in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED') then
    raise exception 'REGISTRATION_LOCKED';
  end if;
  if public.registration_payment_locked(v_reg.id) then
    raise exception 'REGISTRATION_LOCKED';
  end if;

  if p_committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
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

  v_portfolio := nullif(btrim(coalesce(p_portfolio, '')), '');
  if v_portfolio is null and not coalesce(v_committee.is_special_crisis, false) then
    raise exception 'PORTFOLIO_REQUIRED';
  end if;

  if v_reg.delegation_type = 'DOUBLE' and not v_committee.allows_double_del then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;
  if coalesce(v_reg.delegation_type, 'SINGLE') = 'SINGLE' and not coalesce(v_committee.allows_single_del, true) then
    raise exception 'DELEGATION_NOT_ALLOWED';
  end if;

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

  v_slr := p_slr;

  if v_slr is not null then
    update public.registrations
    set allocated_slr = null, allocated_portfolio = null
    where committee_id = v_committee.id
      and allocated_slr = v_slr
      and id is distinct from v_reg.id
      and (v_reg.partner_registration_id is null or id is distinct from v_reg.partner_registration_id);
  end if;

  if not coalesce(v_reg.is_pair_lead, true) then
    v_fee := 0;
  elsif coalesce(v_reg.is_outstation, false) then
    if p_expected_fee_minor is null or p_expected_fee_minor < 0 then
      raise exception 'OUTSTATION_FEE_REQUIRED';
    end if;
    v_fee := p_expected_fee_minor;
  elsif p_expected_fee_minor is not null then
    if p_expected_fee_minor < 0 then
      raise exception 'FEE_INVALID';
    end if;
    v_fee := p_expected_fee_minor;
  else
    v_fee := public.committee_current_fee(v_committee.id, coalesce(v_reg.delegation_type, 'SINGLE'));
  end if;

  update public.registrations
  set
    committee_id = v_committee.id,
    allocated_portfolio = v_portfolio,
    allocated_slr = v_slr,
    expected_fee_minor = v_fee,
    status = 'PAYMENT_PENDING'
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      committee_id = v_committee.id,
      allocated_portfolio = v_portfolio,
      allocated_slr = v_slr,
      expected_fee_minor = case when is_pair_lead then v_fee else 0 end,
      status = case
        when status in ('CONFIRMED', 'PAYMENT_VERIFIED') then status
        else 'PAYMENT_PENDING'
      end,
      delegation_type = 'DOUBLE'
    where id = v_reg.partner_registration_id
      and deleted_at is null
      and status not in ('CANCELLED');
  end if;

  perform public.link_registration_to_payments(v_reg.id);
  if v_reg.partner_registration_id is not null then
    perform public.link_registration_to_payments(v_reg.partner_registration_id);
  end if;
  select * into v_reg from public.registrations where id = v_reg.id;

  perform public.write_audit(
    'registration.allocate',
    'registrations',
    v_reg.id,
    null,
    jsonb_build_object(
      'committee_id', v_committee.id,
      'allocated_portfolio', v_portfolio,
      'allocated_slr', v_slr,
      'expected_fee_minor', v_reg.expected_fee_minor,
      'is_special_crisis', coalesce(v_committee.is_special_crisis, false),
      'is_outstation', coalesce(v_reg.is_outstation, false),
      'fee_manual', p_expected_fee_minor is not null
    )
  );

  return to_jsonb(v_reg);
end;
$$;

revoke all on function public.allocate_registration(uuid, uuid, text, int, int) from public;
grant execute on function public.allocate_registration(uuid, uuid, text, int, int) to authenticated, service_role;
