-- Payable delegates only: no unmatched emails; search by registered email/name.

create or replace function public.attach_email_to_payment(p_payment_id uuid, p_email extensions.citext)
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
      and (
        pp.unmatched_email = p_email
        or pp.user_id in (select u.id from public.users u where u.email = p_email)
      )
  ) then
    raise exception 'DUPLICATE_EMAIL_IN_LIST';
  end if;

  select * into v_user
  from public.users
  where email = p_email and deleted_at is null;
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
  if v_reg.status not in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED')
     or v_reg.expected_fee_minor is null then
    raise exception 'NOT_REGISTERED';
  end if;

  v_amount := v_reg.expected_fee_minor;
  insert into public.payment_participants (
    payment_id, registration_id, user_id, unmatched_email, amount_minor
  ) values (
    p_payment_id, v_reg.id, v_user.id, p_email, v_amount
  )
  returning id into v_part_id;

  perform public.recalculate_payment_expected(p_payment_id);
  return v_part_id;
end;
$$;

create or replace function public.search_payable_delegates(p_edition_id uuid, p_query text)
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
  v_q := replace(replace(v_q, '%', '\%'), '_', '\_');

  return (
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from (
      select
        u.email::text as email,
        u.full_name,
        c.short_name as committee,
        r.expected_fee_minor as fee_minor,
        r.id as registration_id
      from public.registrations r
      join public.users u on u.id = r.user_id
      left join public.committees c on c.id = r.committee_id
      where r.edition_id = p_edition_id
        and r.deleted_at is null
        and r.user_id is distinct from auth.uid()
        and r.status in ('SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED')
        and r.expected_fee_minor is not null
        and (
          u.email::text ilike ('%' || v_q || '%') escape '\'
          or u.full_name ilike ('%' || v_q || '%') escape '\'
        )
        and not exists (
          select 1
          from public.payment_participants pp
          join public.payments p on p.id = pp.payment_id
          where p.edition_id = p_edition_id
            and p.deleted_at is null
            and public.payment_blocks_email(p.status)
            and (pp.user_id = r.user_id or pp.registration_id = r.id)
        )
      order by u.email
      limit 15
    ) x
  );
end;
$$;

revoke all on function public.search_payable_delegates(uuid, text) from public;
grant execute on function public.search_payable_delegates(uuid, text) to authenticated;
