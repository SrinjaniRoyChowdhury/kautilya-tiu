-- Collectives: named groups delegates can join at registration.

create table if not exists public.collectives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collectives_name_len check (char_length(trim(name)) between 2 and 80)
);

create unique index if not exists collectives_name_unique
  on public.collectives (lower(trim(name)));

drop trigger if exists collectives_set_updated_at on public.collectives;
create trigger collectives_set_updated_at
  before update on public.collectives
  for each row execute function public.set_updated_at();

alter table public.registrations
  add column if not exists collective_id uuid references public.collectives (id) on delete set null;

create index if not exists registrations_collective_id_idx
  on public.registrations (collective_id)
  where collective_id is not null;

alter table public.collectives enable row level security;

drop policy if exists collectives_select on public.collectives;
create policy collectives_select on public.collectives
  for select using (true);

drop policy if exists collectives_mutate on public.collectives;
create policy collectives_mutate on public.collectives
  for all using (public.is_staff())
  with check (public.is_staff());

grant select on public.collectives to anon, authenticated, service_role;
grant insert, update, delete on public.collectives to authenticated, service_role;

notify pgrst, 'reload schema';
