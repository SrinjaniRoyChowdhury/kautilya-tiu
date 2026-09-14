-- Rulebook / guidelines: CMS stores external links instead of requiring PDF uploads.

alter table public.conference_documents
  add column if not exists external_url text;

alter table public.conference_documents
  alter column file_name drop not null;

alter table public.conference_documents
  alter column storage_key drop not null;

alter table public.conference_documents
  drop constraint if exists conference_documents_source_check;

alter table public.conference_documents
  add constraint conference_documents_source_check
  check (
    (external_url is not null and length(btrim(external_url)) > 0)
    or (storage_key is not null and length(btrim(storage_key)) > 0)
  );

notify pgrst, 'reload schema';
