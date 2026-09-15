-- Special crisis committees: portfolios assigned by secretariat (no delegate portfolio prefs).

alter table public.committees
  add column if not exists is_special_crisis boolean not null default false;

comment on column public.committees.is_special_crisis is
  'When true, delegates select the committee but do not enter portfolio preferences; secretariat assigns the portfolio.';

create or replace function public.replace_registration_preferences(
  p_registration_id uuid,
  p_preferences jsonb,
  p_require_complete boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations%rowtype;
  v_item jsonb;
  v_order int := 0;
  v_committee public.committees%rowtype;
  v_p1 text;
  v_p2 text;
  v_ids uuid[] := '{}';
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if p_require_complete then
    if jsonb_typeof(p_preferences) is distinct from 'array'
       or jsonb_array_length(coalesce(p_preferences, '[]'::jsonb)) < 2
       or jsonb_array_length(p_preferences) > 3 then
      raise exception 'PREFERENCES_REQUIRED';
    end if;
  end if;

  delete from public.registration_preferences where registration_id = p_registration_id;

  if p_preferences is null or jsonb_typeof(p_preferences) is distinct from 'array' then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_preferences)
  loop
    v_order := v_order + 1;
    if v_order > 3 then
      raise exception 'PREFERENCES_REQUIRED';
    end if;

    if (v_item->>'committee_id') is null or (v_item->>'committee_id') = '' then
      if p_require_complete then
        raise exception 'COMMITTEE_REQUIRED';
      end if;
      continue;
    end if;

    select * into v_committee
    from public.committees
    where id = (v_item->>'committee_id')::uuid
      and edition_id = v_reg.edition_id
      and deleted_at is null;
    if not found then
      raise exception 'COMMITTEE_NOT_FOUND';
    end if;
    if v_committee.id = any (v_ids) then
      raise exception 'PREFERENCE_DUPLICATE';
    end if;
    v_ids := array_append(v_ids, v_committee.id);

    v_p1 := nullif(btrim(coalesce(v_item->>'portfolio_1', '')), '');
    v_p2 := nullif(btrim(coalesce(v_item->>'portfolio_2', '')), '');

    -- Special crisis: secretariat assigns portfolio; do not require delegate entries.
    if coalesce(v_committee.is_special_crisis, false) then
      v_p1 := null;
      v_p2 := null;
    elsif p_require_complete and v_p1 is null then
      raise exception 'PORTFOLIO_REQUIRED';
    end if;

    if v_p2 is not null and v_p1 is not null and lower(v_p2) = lower(v_p1) then
      raise exception 'PORTFOLIO_DUPLICATE';
    end if;

    insert into public.registration_preferences (
      registration_id, preference_order, committee_id, portfolio_1, portfolio_2
    ) values (
      p_registration_id, v_order, v_committee.id, coalesce(v_p1, ''), v_p2
    );
  end loop;

  if v_reg.partner_registration_id is not null and v_reg.is_pair_lead then
    delete from public.registration_preferences where registration_id = v_reg.partner_registration_id;
    insert into public.registration_preferences (
      registration_id, preference_order, committee_id, portfolio_1, portfolio_2
    )
    select
      v_reg.partner_registration_id, preference_order, committee_id, portfolio_1, portfolio_2
    from public.registration_preferences
    where registration_id = p_registration_id;
  end if;
end;
$$;
