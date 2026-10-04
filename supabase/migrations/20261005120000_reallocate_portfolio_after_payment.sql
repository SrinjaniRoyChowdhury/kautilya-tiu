-- After payment/confirmation: Super Admin and Delegate Affairs may change portfolio only
-- (committee stays fixed), with a required reason recorded in audit.

create or replace function public.is_delegate_affairs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'DELEGATE_AFFAIRS'
  );
$$;

create or replace function public.can_reallocate_portfolio_after_payment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.is_delegate_affairs();
$$;

revoke all on function public.is_delegate_affairs() from public;
revoke all on function public.can_reallocate_portfolio_after_payment() from public;
grant execute on function public.is_delegate_affairs() to authenticated, service_role;
grant execute on function public.can_reallocate_portfolio_after_payment() to authenticated, service_role;

create or replace function public.reallocate_portfolio_after_payment(
  p_registration_id uuid,
  p_portfolio text,
  p_reason text,
  p_slr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_committee public.committees%rowtype;
  v_portfolio text;
  v_slr int;
  v_old_portfolio text;
  v_old_slr int;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.can_reallocate_portfolio_after_payment() then
    raise exception 'FORBIDDEN';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_reg
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Payment done / free-confirmed only (not UNDER_REVIEW drafts).
  if not (
    v_reg.status in ('PAYMENT_VERIFIED', 'CONFIRMED')
    or public.registration_has_verified_payment(v_reg.id)
  ) then
    raise exception 'NOT_PAID';
  end if;

  if v_reg.committee_id is null then
    raise exception 'COMMITTEE_REQUIRED';
  end if;

  select * into v_committee
  from public.committees
  where id = v_reg.committee_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'COMMITTEE_NOT_FOUND';
  end if;

  v_portfolio := nullif(btrim(coalesce(p_portfolio, '')), '');
  if v_portfolio is null and not coalesce(v_committee.is_special_crisis, false) then
    raise exception 'PORTFOLIO_REQUIRED';
  end if;

  v_old_portfolio := v_reg.allocated_portfolio;
  v_old_slr := v_reg.allocated_slr;
  v_slr := p_slr;

  if v_slr is not null then
    update public.registrations
    set allocated_slr = null
    where committee_id = v_committee.id
      and allocated_slr = v_slr
      and id is distinct from v_reg.id
      and (v_reg.partner_registration_id is null or id is distinct from v_reg.partner_registration_id);
  end if;

  update public.registrations
  set
    allocated_portfolio = v_portfolio,
    allocated_slr = v_slr
  where id = v_reg.id
  returning * into v_reg;

  if v_reg.partner_registration_id is not null then
    update public.registrations
    set
      allocated_portfolio = v_portfolio,
      allocated_slr = v_slr
    where id = v_reg.partner_registration_id
      and deleted_at is null
      and status not in ('CANCELLED');
  end if;

  perform public.write_audit(
    'registration.reallocate_portfolio',
    'registrations',
    v_reg.id,
    jsonb_build_object(
      'committee_id', v_committee.id,
      'allocated_portfolio', v_old_portfolio,
      'allocated_slr', v_old_slr
    ),
    jsonb_build_object(
      'committee_id', v_committee.id,
      'allocated_portfolio', v_portfolio,
      'allocated_slr', v_slr,
      'reason', v_reason
    )
  );

  return to_jsonb(v_reg);
end;
$$;

revoke all on function public.reallocate_portfolio_after_payment(uuid, text, text, int) from public;
grant execute on function public.reallocate_portfolio_after_payment(uuid, text, text, int) to authenticated, service_role;

notify pgrst, 'reload schema';
