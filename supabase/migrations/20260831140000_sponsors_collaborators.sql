-- CMS-managed sponsors and collaborators for the homepage.

create table public.cms_sponsors (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  name text not null,
  category text not null,
  logo_url text,
  display_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_sponsors_category_check check (
    category in ('title', 'gold', 'silver', 'partner')
  )
);

create trigger cms_sponsors_set_updated_at
  before update on public.cms_sponsors
  for each row execute function public.set_updated_at();

create table public.cms_collaborators (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  name text not null,
  category text not null,
  logo_url text,
  display_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_collaborators_category_check check (
    category in ('society', 'institution', 'media', 'partner')
  )
);

create trigger cms_collaborators_set_updated_at
  before update on public.cms_collaborators
  for each row execute function public.set_updated_at();

alter table public.cms_sponsors enable row level security;
alter table public.cms_collaborators enable row level security;

create policy cms_sponsors_select on public.cms_sponsors
  for select using (published = true or public.has_permission('cms.manage'));

create policy cms_sponsors_mutate on public.cms_sponsors
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_collaborators_select on public.cms_collaborators
  for select using (published = true or public.has_permission('cms.manage'));

create policy cms_collaborators_mutate on public.cms_collaborators
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

grant select on public.cms_sponsors, public.cms_collaborators to anon;
