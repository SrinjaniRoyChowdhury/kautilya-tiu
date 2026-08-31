-- Editor-controlled faces for /contact "Who reads the desk".
alter table public.site_settings
  add column if not exists contact_desk_faces jsonb not null default '[]'::jsonb;

alter table public.site_settings
  add column if not exists contact_desk_limit int not null default 3;

alter table public.site_settings
  drop constraint if exists site_settings_contact_desk_limit_check;

alter table public.site_settings
  add constraint site_settings_contact_desk_limit_check
  check (contact_desk_limit >= 0 and contact_desk_limit <= 24);
