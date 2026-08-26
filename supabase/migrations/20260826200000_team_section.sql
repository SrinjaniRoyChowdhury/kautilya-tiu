-- Distinguish core secretariat officers from USG departments on cms_team_members.

alter table public.cms_team_members
  add column if not exists section text not null default 'CORE';

alter table public.cms_team_members
  drop constraint if exists cms_team_members_section_check;

alter table public.cms_team_members
  add constraint cms_team_members_section_check
  check (section in ('CORE', 'USG'));

alter table public.cms_team_members
  alter column full_name set default '';

update public.cms_team_members
set section = 'USG'
where section = 'CORE'
  and (
    role_title ilike 'USG%'
    or full_name in ('Finance & Ops', 'Delegate Affairs')
  );

-- Replace leftover placeholder seed rows with the Niti Sabha 2.0 roster.
delete from public.cms_team_members
where (full_name, role_title) in (
  ('Secretariat', 'Secretary-General'),
  ('Directorate', 'Director-General'),
  ('Finance & Ops', 'USG Administration'),
  ('Delegate Affairs', 'USG Delegate Experience')
);

insert into public.cms_team_members (edition_id, section, full_name, role_title, bio, display_order, published)
select edition_id, section, full_name, role_title, bio, display_order, published
from (values
  (null::uuid, 'CORE', 'Nilanjana & Pratik', 'Secretary-General', null::text, 10, true),
  (null::uuid, 'CORE', 'Chirag', 'Deputy Secretary-General', null::text, 20, true),
  (null::uuid, 'CORE', 'Vaishnavi', 'Director-General', null::text, 30, true),
  (null::uuid, 'CORE', 'Swapnil', 'Chief of Staff', null::text, 40, true),
  (null::uuid, 'CORE', 'Bipul & Sirsantika', U&'Charg\00E9 d\2019Affaires', null::text, 50, true),
  (null::uuid, 'CORE', 'Pritam', 'Equity Officer', null::text, 60, true)
) as roster(edition_id, section, full_name, role_title, bio, display_order, published)
where not exists (select 1 from public.cms_team_members where section = 'CORE');

insert into public.cms_team_members (edition_id, section, full_name, role_title, bio, display_order, published)
select edition_id, section, full_name, role_title, bio, display_order, published
from (values
  (null::uuid, 'USG', '', 'Delegate Affairs', null::text, 110, true),
  (null::uuid, 'USG', '', 'Logistics & Operations', null::text, 120, true),
  (null::uuid, 'USG', '', 'Hospitality', null::text, 130, true),
  (null::uuid, 'USG', '', 'Marketing & External Outreach', null::text, 140, true),
  (null::uuid, 'USG', '', 'Media, Design & Creatives', null::text, 150, true),
  (null::uuid, 'USG', '', 'Communications & Documentation', null::text, 160, true),
  (null::uuid, 'USG', '', 'Finance & Sponsorships', null::text, 170, true),
  (null::uuid, 'USG', '', 'Administration & Management', null::text, 180, true),
  (null::uuid, 'USG', '', 'Executive Board & Committee Affairs', null::text, 190, true)
) as roster(edition_id, section, full_name, role_title, bio, display_order, published)
where not exists (select 1 from public.cms_team_members where section = 'USG');
