-- Restore public branding: site is Kautilya; presenting line is Kautilya MUN Nitisabha.

update public.site_settings
set society_name = 'Kautilya'
where society_name in ('Niti Sabha', 'Kautilya MUN', 'Kautilya Model United Nations');

update public.mun_editions
set name = replace(name, 'Niti Sabha', 'Kautilya')
where name like '%Niti Sabha%';

update public.announcements
set title = replace(title, 'Niti Sabha', 'Kautilya')
where title like '%Niti Sabha%';

update public.payment_instructions
set account_name = 'Kautilya MUN Nitisabha'
where account_name in ('Techno Kautilya', 'Kautilya MUN', 'Kautilya MUN Society');

update public.email_templates
set subject = replace(subject, 'Niti Sabha', 'Kautilya')
where subject like '%Niti Sabha%';

alter table public.site_settings
  alter column society_name set default 'Kautilya';
