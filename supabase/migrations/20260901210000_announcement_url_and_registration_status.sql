-- Add link_url to announcements and registration_status to mun_editions.

alter table public.announcements
  add column if not exists link_url text;

alter table public.mun_editions
  add column if not exists registration_status text not null default 'OPEN';

alter table public.mun_editions
  drop constraint if exists mun_editions_registration_status_check;

alter table public.mun_editions
  add constraint mun_editions_registration_status_check
  check (registration_status in ('OPEN', 'CLOSED'));

-- Update assert_registration_window to respect edition registration_status
create or replace function public.assert_registration_window(p_edition public.mun_editions)
returns void
language plpgsql
stable
as $$
begin
  if p_edition.status <> 'PUBLISHED' or p_edition.deleted_at is not null then
    raise exception 'EDITION_NOT_OPEN';
  end if;
  if p_edition.registration_status = 'CLOSED' then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if p_edition.registration_open_at is not null and now() < p_edition.registration_open_at then
    raise exception 'REGISTRATION_NOT_OPEN';
  end if;
  if p_edition.registration_close_at is not null and now() > p_edition.registration_close_at then
    raise exception 'REGISTRATION_CLOSED';
  end if;
end;
$$;
