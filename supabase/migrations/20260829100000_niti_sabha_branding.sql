-- Rename conference branding from Kautilya MUN to Niti Sabha (existing rows).

update public.site_settings
set society_name = 'Niti Sabha'
where society_name in ('Kautilya MUN', 'Kautilya Model United Nations');

update public.mun_editions
set name = replace(name, 'Kautilya MUN', 'Niti Sabha')
where name like '%Kautilya MUN%';

update public.announcements
set title = replace(title, 'Kautilya MUN', 'Niti Sabha')
where title like '%Kautilya MUN%';

update public.payment_instructions
set account_name = 'Techno Kautilya'
where account_name = 'Kautilya MUN Society';

update public.email_templates
set subject = replace(subject, 'Kautilya MUN', 'Niti Sabha')
where subject like '%Kautilya MUN%';

alter table public.site_settings
  alter column society_name set default 'Niti Sabha';
