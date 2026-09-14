-- Avoid unique-index collisions when switching the active registration phase.
-- A single UPDATE that flips one row off and another on can violate
-- registration_phases_one_active mid-statement; clear first, then set.

create or replace function public.activate_registration_phase(p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition uuid;
begin
  if not public.has_permission('edition.manage', null) then
    raise exception 'FORBIDDEN';
  end if;
  select edition_id into v_edition from public.registration_phases where id = p_phase_id;
  if v_edition is null then
    raise exception 'NOT_FOUND';
  end if;

  update public.registration_phases
  set is_active = false
  where edition_id = v_edition
    and is_active
    and id is distinct from p_phase_id;

  update public.registration_phases
  set is_active = true
  where id = p_phase_id
    and edition_id = v_edition;

  update public.committees c
  set fee_minor = public.committee_current_fee(c.id, 'SINGLE')
  where c.edition_id = v_edition and c.deleted_at is null;
end;
$$;
