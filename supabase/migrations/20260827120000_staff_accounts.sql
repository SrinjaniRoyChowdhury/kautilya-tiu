-- Staff accounts: username logins + Delegate Affairs / Viewer roles.

alter table public.users
  add column if not exists username citext;

create unique index if not exists users_username_unique
  on public.users (username)
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.users (id, email, full_name, phone, email_verified_at, username)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email_confirmed_at,
    nullif(lower(new.raw_user_meta_data->>'username'), '')
  );
  if new.email_confirmed_at is not null then
    perform public.link_user_to_unmatched_payments(new.id);
  end if;
  return new;
end;
$$;

do $$
declare
  rec record;
  candidate text;
  suffix int;
begin
  for rec in
    select u.id, lower(split_part(u.email::text, '@', 1)) as local_part
    from public.users u
    join public.scanner_secrets s on s.user_id = u.id
    where u.username is null
  loop
    candidate := rec.local_part;
    if candidate !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' or char_length(candidate) < 3 then
      candidate := 'staff' || substr(replace(rec.id::text, '-', ''), 1, 8);
    end if;
    suffix := 0;
    while exists (select 1 from public.users where username = candidate) loop
      suffix := suffix + 1;
      candidate := left(rec.local_part, 24) || suffix::text;
    end loop;
    update public.users set username = candidate where id = rec.id;
  end loop;
end $$;

insert into public.roles (name, description)
values
  ('DELEGATE_AFFAIRS', 'Manage registrations, allocations, and delegate records'),
  ('VIEWER', 'Read-only access to admin lists and reports')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'registration.view',
  'registration.edit',
  'qr.regenerate',
  'payment.view',
  'report.participants'
)
where r.name = 'DELEGATE_AFFAIRS'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'registration.view',
  'payment.view',
  'audit.view',
  'report.export',
  'report.payments',
  'report.participants',
  'report.food'
)
where r.name = 'VIEWER'
on conflict do nothing;
