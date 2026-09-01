-- Help Desk Queries submitted via the contacts page.

create table public.help_desk_queries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email extensions.citext not null,
  phone text not null,
  type text not null,
  subject text not null,
  description text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_desk_queries_type_check check (
    type in ('Delegate Queries', 'Partnership', 'Press and Faculty')
  ),
  constraint help_desk_queries_status_check check (
    status in ('PENDING', 'RESOLVED', 'ARCHIVED')
  )
);

create trigger help_desk_queries_set_updated_at
  before update on public.help_desk_queries
  for each row execute function public.set_updated_at();

create index help_desk_queries_created_at_idx on public.help_desk_queries (created_at desc);
create index help_desk_queries_type_idx on public.help_desk_queries (type);

alter table public.help_desk_queries enable row level security;

-- Public can submit queries
create policy help_desk_queries_insert on public.help_desk_queries
  for insert with check (true);

-- Staff can view and update queries
create policy help_desk_queries_select on public.help_desk_queries
  for select using (public.is_staff());

create policy help_desk_queries_update on public.help_desk_queries
  for update using (public.is_staff())
  with check (public.is_staff());

grant insert on public.help_desk_queries to anon, authenticated;
grant select, update on public.help_desk_queries to authenticated;
