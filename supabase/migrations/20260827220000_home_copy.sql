-- Home hero: drop "Editions hosted". Secretary-General name order: Pratik & Nilanjana.

update public.site_settings
set hero_stats = coalesce(
  (
    select jsonb_agg(elem)
    from jsonb_array_elements(hero_stats) as elem
    where lower(trim(elem->>'label')) <> 'editions hosted'
  ),
  '[]'::jsonb
);

update public.cms_team_members
set full_name = 'Pratik & Nilanjana'
where section = 'CORE'
  and role_title = 'Secretary-General'
  and full_name = 'Nilanjana & Pratik';
