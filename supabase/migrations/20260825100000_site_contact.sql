-- Persist public contact details that were edited in the already-applied init seed.
-- Editing 20260824120000_init.sql does not update a running database.
update public.site_settings
set
  contact_email = 'tiukautilya@gmail.com',
  contact_address = 'Techno India University, West Bengal, India',
  instagram_url = 'https://www.instagram.com/kautilya_tiu/'
where id = true;
