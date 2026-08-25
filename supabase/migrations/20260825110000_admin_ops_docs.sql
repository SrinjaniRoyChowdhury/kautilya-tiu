-- Conference PDFs, registration acknowledgement, and lunch / evening-snacks meal names.

alter table public.registrations
  add column if not exists accepted_rules_at timestamptz;

create table if not exists public.conference_documents (
  kind text primary key check (kind in ('rulebook', 'guidelines')),
  file_name text not null,
  storage_key text not null,
  uploaded_by uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger conference_documents_set_updated_at
  before update on public.conference_documents
  for each row execute function public.set_updated_at();

alter table public.conference_documents enable row level security;

create policy conference_documents_select on public.conference_documents
  for select using (true);
create policy conference_documents_mutate on public.conference_documents
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

grant select on public.conference_documents to anon, authenticated, service_role;
grant insert, update, delete on public.conference_documents to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conference-docs',
  'conference-docs',
  false,
  15728640,
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists conference_docs_staff_write on storage.objects;
create policy conference_docs_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'conference-docs' and public.has_permission('cms.manage'))
  with check (bucket_id = 'conference-docs' and public.has_permission('cms.manage'));

update public.meal_types
set name = 'Evening snacks'
where lower(name) in ('snacks', 'evening snack')
  and not exists (
    select 1
    from public.meal_types other
    where other.edition_id = meal_types.edition_id
      and other.name = 'Evening snacks'
  );

update public.meal_types
set name = 'Lunch'
where lower(name) = 'lunch';
