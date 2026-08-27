-- Admin-managed institution names for registration typeahead. Delegates may still type a custom name.

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutions_name_len check (char_length(trim(name)) between 2 and 120)
);

create unique index if not exists institutions_name_unique
  on public.institutions (lower(trim(name)));

drop trigger if exists institutions_set_updated_at on public.institutions;
create trigger institutions_set_updated_at
  before update on public.institutions
  for each row execute function public.set_updated_at();

alter table public.institutions enable row level security;

drop policy if exists institutions_select on public.institutions;
create policy institutions_select on public.institutions
  for select using (true);

drop policy if exists institutions_mutate on public.institutions;
create policy institutions_mutate on public.institutions
  for all using (public.has_permission('edition.manage'))
  with check (public.has_permission('edition.manage'));

grant select on public.institutions to anon, authenticated, service_role;
grant insert, update, delete on public.institutions to authenticated, service_role;
