-- Kautilya MUN Platform — Phase 1 foundation schema
-- Adapts SRS §13 for Supabase Auth: credentials live in auth.users;
-- public.users is the profile/PII row (1:1 with auth.users).

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (SRS §13 / §26.3)
-- ---------------------------------------------------------------------------

create type public.user_status as enum ('ACTIVE', 'SUSPENDED');
create type public.edition_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.committee_status as enum ('OPEN', 'CLOSED', 'HIDDEN');
create type public.registration_status as enum (
  'DRAFT',
  'SUBMITTED',
  'PAYMENT_PENDING',
  'PAYMENT_VERIFIED',
  'PAYMENT_REJECTED',
  'CONFIRMED',
  'CANCELLED'
);
create type public.food_preference as enum ('VEG', 'NON_VEG');
create type public.field_type as enum (
  'text',
  'number',
  'select',
  'multiselect',
  'date',
  'boolean',
  'file'
);
create type public.field_section as enum ('PERSONAL', 'MUN_INFO', 'FOOD', 'ADDITIONAL');
create type public.payment_status as enum (
  'DRAFT',
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'CANCELLED'
);
create type public.amount_flag as enum ('UNDERPAID', 'EXACT', 'OVERPAID', 'UNKNOWN');
create type public.qr_status as enum ('ACTIVE', 'REVOKED');
create type public.attendance_method as enum ('QR_SCAN', 'MANUAL');
create type public.email_log_status as enum ('QUEUED', 'SENT', 'FAILED');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core identity (SRS "users")
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  email citext not null unique,
  email_verified_at timestamptz,
  full_name text not null,
  phone text,
  status public.user_status not null default 'ACTIVE',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email_confirmed_at
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_user_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email_verified_at = new.email_confirmed_at,
      email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.sync_user_email_verified();

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger permissions_set_updated_at
  before update on public.permissions
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  edition_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_roles_global_unique
  on public.user_roles (user_id, role_id)
  where edition_id is null;

create unique index user_roles_edition_unique
  on public.user_roles (user_id, role_id, edition_id)
  where edition_id is not null;

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Editions & committees
-- ---------------------------------------------------------------------------

create table public.mun_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  slug text not null unique,
  theme text,
  start_date date,
  end_date date,
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  status public.edition_status not null default 'DRAFT',
  is_public_active boolean not null default false,
  created_by uuid references public.users (id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, name)
);

create index mun_editions_status_idx on public.mun_editions (status);
create index mun_editions_public_active_idx on public.mun_editions (is_public_active)
  where is_public_active = true;

create trigger mun_editions_set_updated_at
  before update on public.mun_editions
  for each row execute function public.set_updated_at();

alter table public.user_roles
  add constraint user_roles_edition_fk
  foreign key (edition_id) references public.mun_editions (id) on delete restrict;

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  name text not null,
  short_name text not null,
  slug text not null,
  description text,
  rules_url text,
  capacity int not null check (capacity >= 0),
  confirmed_count int not null default 0 check (confirmed_count >= 0),
  fee_minor int not null default 0 check (fee_minor >= 0),
  eb_json jsonb not null default '[]'::jsonb,
  portfolio_config jsonb not null default '[]'::jsonb,
  status public.committee_status not null default 'OPEN',
  display_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, short_name),
  unique (edition_id, slug)
);

create index committees_edition_status_idx on public.committees (edition_id, status);

create trigger committees_set_updated_at
  before update on public.committees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------------

create table public.registration_field_definitions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  field_key text not null,
  label text not null,
  field_type public.field_type not null,
  required boolean not null default false,
  options jsonb,
  validation jsonb,
  display_order int not null default 0,
  section public.field_section not null default 'ADDITIONAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, field_key)
);

create trigger registration_field_definitions_set_updated_at
  before update on public.registration_field_definitions
  for each row execute function public.set_updated_at();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete restrict,
  committee_id uuid references public.committees (id) on delete restrict,
  status public.registration_status not null default 'DRAFT',
  food_preference public.food_preference,
  expected_fee_minor int,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  capacity_override boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index registrations_one_active_per_user_edition
  on public.registrations (edition_id, user_id)
  where status <> 'CANCELLED' and deleted_at is null;

create index registrations_edition_status_idx on public.registrations (edition_id, status);
create index registrations_committee_idx on public.registrations (committee_id);

create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function public.set_updated_at();

create table public.registration_field_values (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  field_definition_id uuid not null references public.registration_field_definitions (id) on delete restrict,
  value_text text,
  value_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, field_definition_id)
);

create trigger registration_field_values_set_updated_at
  before update on public.registration_field_values
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table public.payment_instructions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null unique references public.mun_editions (id) on delete restrict,
  upi_id text,
  upi_qr_image_key text,
  bank_name text,
  account_name text,
  account_number text,
  ifsc text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_instructions_set_updated_at
  before update on public.payment_instructions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  payer_user_id uuid not null references public.users (id) on delete restrict,
  expected_amount_minor int not null default 0,
  paid_amount_minor int,
  currency char(3) not null default 'INR',
  status public.payment_status not null default 'DRAFT',
  amount_flag public.amount_flag not null default 'UNKNOWN',
  proof_image_key text,
  transaction_ref text,
  paid_at timestamptz,
  verified_by uuid references public.users (id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_edition_status_idx on public.payments (edition_id, status);
create index payments_payer_idx on public.payments (payer_user_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_participants (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  registration_id uuid references public.registrations (id) on delete restrict,
  user_id uuid references public.users (id) on delete restrict,
  unmatched_email citext,
  amount_minor int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_participants_target_chk
    check (registration_id is not null or unmatched_email is not null)
);

create unique index payment_participants_reg_unique
  on public.payment_participants (payment_id, registration_id)
  where registration_id is not null;

create unique index payment_participants_email_unique
  on public.payment_participants (payment_id, unmatched_email)
  where unmatched_email is not null;

create index payment_participants_unmatched_email_idx
  on public.payment_participants (unmatched_email)
  where unmatched_email is not null;

create index payment_participants_registration_idx
  on public.payment_participants (registration_id);

create trigger payment_participants_set_updated_at
  before update on public.payment_participants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- QR / attendance / food
-- ---------------------------------------------------------------------------

create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  token text not null unique,
  display_code text not null,
  status public.qr_status not null default 'ACTIVE',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index qr_tokens_one_active_per_registration
  on public.qr_tokens (registration_id)
  where status = 'ACTIVE';

create trigger qr_tokens_set_updated_at
  before update on public.qr_tokens
  for each row execute function public.set_updated_at();

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  event_day smallint not null check (event_day between 1 and 3),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  recorded_by uuid references public.users (id) on delete restrict,
  method public.attendance_method not null default 'QR_SCAN',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, event_day)
);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

create table public.meal_types (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, name)
);

create trigger meal_types_set_updated_at
  before update on public.meal_types
  for each row execute function public.set_updated_at();

create table public.meal_schedules (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  event_day smallint not null check (event_day between 1 and 3),
  meal_type_id uuid not null references public.meal_types (id) on delete restrict,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, event_day, meal_type_id)
);

create trigger meal_schedules_set_updated_at
  before update on public.meal_schedules
  for each row execute function public.set_updated_at();

create table public.food_distribution (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  meal_schedule_id uuid not null references public.meal_schedules (id) on delete restrict,
  collected_at timestamptz not null default now(),
  collected_by uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, meal_schedule_id)
);

create trigger food_distribution_set_updated_at
  before update on public.food_distribution
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CMS / notifications / audit
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id boolean primary key default true check (id),
  society_name text not null default 'Kautilya MUN',
  tagline text,
  about_html text,
  mission_html text,
  history_html text,
  contact_email text,
  contact_phone text,
  contact_address text,
  instagram_url text,
  linkedin_url text,
  hero_stats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  page_key text not null,
  title text not null,
  body_html text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_key, edition_id)
);

create trigger cms_pages_set_updated_at
  before update on public.cms_pages
  for each row execute function public.set_updated_at();

create table public.cms_team_members (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  full_name text not null,
  role_title text not null,
  bio text,
  photo_url text,
  display_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cms_team_members_set_updated_at
  before update on public.cms_team_members
  for each row execute function public.set_updated_at();

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  title text not null,
  body_html text not null,
  published boolean not null default false,
  published_at timestamptz,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_published_idx on public.announcements (published, published_at desc);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.mun_editions (id) on delete restrict,
  title text not null,
  description text,
  published boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gallery_albums_set_updated_at
  before update on public.gallery_albums
  for each row execute function public.set_updated_at();

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums (id) on delete cascade,
  storage_key text not null,
  caption text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gallery_images_set_updated_at
  before update on public.gallery_images
  for each row execute function public.set_updated_at();

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.mun_editions (id) on delete restrict,
  key text not null,
  subject text not null,
  body_html text not null,
  editable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, edition_id)
);

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete restrict,
  to_email citext not null,
  template_key text not null,
  status public.email_log_status not null default 'QUEUED',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_logs_set_updated_at
  before update on public.email_logs
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete restrict,
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

create or replace view public.v_participants as
select
  r.id as registration_id,
  r.edition_id,
  r.user_id,
  r.committee_id,
  r.status as registration_status,
  r.food_preference,
  r.expected_fee_minor,
  r.submitted_at,
  r.confirmed_at,
  u.full_name,
  u.email,
  u.phone,
  c.name as committee_name,
  c.short_name as committee_short_name
from public.registrations r
join public.users u on u.id = r.user_id
left join public.committees c on c.id = r.committee_id
where r.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Confirmed-count maintenance
-- ---------------------------------------------------------------------------

create or replace function public.sync_committee_confirmed_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.committee_id is not null
       and (old.status = 'CONFIRMED')
       and (new.status is distinct from 'CONFIRMED' or new.committee_id is distinct from old.committee_id) then
      update public.committees
      set confirmed_count = greatest(confirmed_count - 1, 0)
      where id = old.committee_id;
    end if;
    if new.committee_id is not null
       and new.status = 'CONFIRMED'
       and (old.status is distinct from 'CONFIRMED' or old.committee_id is distinct from new.committee_id) then
      update public.committees
      set confirmed_count = confirmed_count + 1
      where id = new.committee_id;
    end if;
  elsif tg_op = 'INSERT' and new.status = 'CONFIRMED' and new.committee_id is not null then
    update public.committees
    set confirmed_count = confirmed_count + 1
    where id = new.committee_id;
  end if;
  return new;
end;
$$;

create trigger registrations_sync_confirmed_count
  after insert or update of status, committee_id on public.registrations
  for each row execute function public.sync_committee_confirmed_count();

-- ---------------------------------------------------------------------------
-- RBAC helpers (security definer so RLS can call them)
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
  );
$$;

create or replace function public.has_permission(p_code text, p_edition_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = p_code
      and (ur.edition_id is null or (p_edition_id is not null and ur.edition_id = p_edition_id))
  );
$$;

create or replace function public.current_profile()
returns public.users
language sql
stable
security definer
set search_path = public
as $$
  select * from public.users where id = auth.uid();
$$;

create or replace function public.write_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_old jsonb default null,
  p_new jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_user_id, action, entity, entity_id, old_value, new_value)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_old, p_new);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.mun_editions enable row level security;
alter table public.committees enable row level security;
alter table public.registration_field_definitions enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_field_values enable row level security;
alter table public.payment_instructions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_participants enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.attendance enable row level security;
alter table public.meal_types enable row level security;
alter table public.meal_schedules enable row level security;
alter table public.food_distribution enable row level security;
alter table public.site_settings enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_team_members enable row level security;
alter table public.announcements enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_images enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- users
create policy users_select_self_or_staff on public.users
  for select using (id = auth.uid() or public.is_staff());
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- roles catalogue readable by staff
create policy roles_select_staff on public.roles
  for select using (public.is_staff());
create policy permissions_select_staff on public.permissions
  for select using (public.is_staff());
create policy role_permissions_select_staff on public.role_permissions
  for select using (public.is_staff());
create policy user_roles_select_self_or_staff on public.user_roles
  for select using (user_id = auth.uid() or public.is_staff());
create policy user_roles_mutate_super on public.user_roles
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- editions: public can read published/archived (historical remain browsable)
create policy editions_select_public on public.mun_editions
  for select using (
    (status in ('PUBLISHED', 'ARCHIVED') and deleted_at is null)
    or public.is_staff()
  );
create policy editions_mutate_admin on public.mun_editions
  for all using (public.has_permission('edition.manage'))
  with check (public.has_permission('edition.manage'));

-- committees
create policy committees_select_public on public.committees
  for select using (
    (
      status in ('OPEN', 'CLOSED')
      and deleted_at is null
      and exists (
        select 1 from public.mun_editions e
        where e.id = edition_id
          and e.status in ('PUBLISHED', 'ARCHIVED')
          and e.deleted_at is null
      )
    )
    or public.is_staff()
  );
create policy committees_mutate_admin on public.committees
  for all using (public.has_permission('committee.manage', edition_id))
  with check (public.has_permission('committee.manage', edition_id));

-- field definitions: authenticated (for registration) + staff
create policy field_defs_select on public.registration_field_definitions
  for select using (auth.uid() is not null);
create policy field_defs_mutate on public.registration_field_definitions
  for all using (public.has_permission('committee.manage', edition_id))
  with check (public.has_permission('committee.manage', edition_id));

-- registrations (Phase 2 will use these)
create policy registrations_select_own_or_staff on public.registrations
  for select using (user_id = auth.uid() or public.has_permission('registration.view', edition_id));
create policy registrations_insert_own on public.registrations
  for insert with check (user_id = auth.uid());
create policy registrations_update_own_or_staff on public.registrations
  for update using (
    user_id = auth.uid() or public.has_permission('registration.edit', edition_id)
  );

create policy field_values_select on public.registration_field_values
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('registration.view', r.edition_id))
    )
  );
create policy field_values_mutate_own on public.registration_field_values
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('registration.edit', r.edition_id))
    )
  );

-- payments
create policy payments_select on public.payments
  for select using (
    payer_user_id = auth.uid() or public.has_permission('payment.view', edition_id)
  );
create policy payments_insert_own on public.payments
  for insert with check (payer_user_id = auth.uid());
create policy payments_update on public.payments
  for update using (
    payer_user_id = auth.uid() or public.has_permission('payment.verify', edition_id)
  );

create policy payment_participants_select on public.payment_participants
  for select using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and (p.payer_user_id = auth.uid() or public.has_permission('payment.view', p.edition_id))
    )
  );
create policy payment_participants_mutate on public.payment_participants
  for all using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id
        and (p.payer_user_id = auth.uid() or public.has_permission('payment.verify', p.edition_id))
    )
  );

create policy payment_instructions_select on public.payment_instructions
  for select using (auth.uid() is not null);
create policy payment_instructions_mutate on public.payment_instructions
  for all using (public.has_permission('edition.manage', edition_id))
  with check (public.has_permission('edition.manage', edition_id));

-- QR / attendance / food
create policy qr_select on public.qr_tokens
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.is_staff())
    )
  );

create policy attendance_select on public.attendance
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('attendance.scan', r.edition_id))
    )
  );
create policy attendance_mutate on public.attendance
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and public.has_permission('attendance.scan', r.edition_id)
    )
  );

create policy meal_types_select on public.meal_types
  for select using (auth.uid() is not null or public.is_staff());
create policy meal_types_mutate on public.meal_types
  for all using (public.has_permission('edition.manage', edition_id))
  with check (public.has_permission('edition.manage', edition_id));
create policy meal_schedules_select on public.meal_schedules
  for select using (auth.uid() is not null or public.is_staff());
create policy meal_schedules_mutate on public.meal_schedules
  for all using (public.has_permission('edition.manage', edition_id))
  with check (public.has_permission('edition.manage', edition_id));

create policy food_select on public.food_distribution
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (r.user_id = auth.uid() or public.has_permission('food.scan', r.edition_id))
    )
  );
create policy food_mutate on public.food_distribution
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and public.has_permission('food.scan', r.edition_id)
    )
  );

-- CMS public reads
create policy site_settings_select on public.site_settings
  for select using (true);
create policy site_settings_mutate on public.site_settings
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy cms_pages_select on public.cms_pages
  for select using (published = true or public.has_permission('cms.manage'));
create policy cms_pages_mutate on public.cms_pages
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy team_select on public.cms_team_members
  for select using (published = true or public.has_permission('cms.manage'));
create policy team_mutate on public.cms_team_members
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy announcements_select on public.announcements
  for select using (published = true or public.has_permission('cms.manage'));
create policy announcements_mutate on public.announcements
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy gallery_albums_select on public.gallery_albums
  for select using (published = true or public.has_permission('cms.manage'));
create policy gallery_albums_mutate on public.gallery_albums
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy gallery_images_select on public.gallery_images
  for select using (
    exists (
      select 1 from public.gallery_albums a
      where a.id = album_id and (a.published = true or public.has_permission('cms.manage'))
    )
  );

create policy email_templates_staff on public.email_templates
  for all using (public.is_staff()) with check (public.is_staff());
create policy email_logs_staff on public.email_logs
  for select using (public.is_staff());

create policy notifications_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid());

create policy audit_select on public.audit_logs
  for select using (public.has_permission('audit.view'));

-- ---------------------------------------------------------------------------
-- Grants (Supabase no longer auto-exposes new public objects)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on public.mun_editions, public.committees, public.site_settings,
  public.cms_pages, public.cms_team_members, public.announcements,
  public.gallery_albums, public.gallery_images
  to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.has_permission(text, uuid) to anon, authenticated;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.write_audit(text, text, uuid, jsonb, jsonb) to authenticated;
grant select on public.v_participants to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('cms-media', 'cms-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy payment_proofs_select on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      owner = auth.uid()
      or public.has_permission('payment.view')
    )
  );
create policy payment_proofs_insert on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs' and owner = auth.uid()
  );

create policy gallery_public_read on storage.objects
  for select using (bucket_id in ('gallery', 'cms-media'));
create policy gallery_staff_write on storage.objects
  for all using (
    bucket_id in ('gallery', 'cms-media') and public.has_permission('cms.manage')
  )
  with check (
    bucket_id in ('gallery', 'cms-media') and public.has_permission('cms.manage')
  );

-- ---------------------------------------------------------------------------
-- RBAC catalogue (SRS §23)
-- ---------------------------------------------------------------------------

insert into public.roles (name, description) values
  ('SUPER_ADMIN', 'Full system access across all editions'),
  ('ADMIN', 'Broad management access within assigned edition(s)'),
  ('PAYMENT_ADMIN', 'Payment verification only'),
  ('REGISTRATION_ADMIN', 'Registration, participant, and committee management'),
  ('ATTENDANCE_OPERATOR', 'QR scanning and attendance correction at the venue'),
  ('FOOD_OPERATOR', 'QR scanning and food-collection marking at the venue');

insert into public.permissions (code, description) values
  ('edition.manage', 'Create and update MUN editions'),
  ('committee.manage', 'Create and update committees'),
  ('registration.view', 'View registrations and participants'),
  ('registration.edit', 'Edit or cancel registrations'),
  ('payment.view', 'View payment proofs and amounts'),
  ('payment.verify', 'Verify or reject payments'),
  ('qr.regenerate', 'Regenerate or revoke QR tokens'),
  ('attendance.scan', 'Scan and mark attendance'),
  ('attendance.correct', 'Manually correct attendance'),
  ('food.scan', 'Scan and mark food collected'),
  ('cms.manage', 'Manage public CMS content'),
  ('users.manage', 'Manage admin users and roles'),
  ('audit.view', 'View audit logs'),
  ('report.export', 'Export reports'),
  ('report.payments', 'Export payment reports'),
  ('report.participants', 'Export participant/attendance reports'),
  ('report.food', 'Export food reports');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'SUPER_ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'edition.manage', 'committee.manage', 'registration.view', 'registration.edit',
  'payment.view', 'payment.verify', 'qr.regenerate', 'attendance.scan',
  'attendance.correct', 'food.scan', 'cms.manage', 'audit.view', 'report.export',
  'report.payments', 'report.participants', 'report.food'
)
where r.name = 'ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'registration.view', 'payment.view', 'payment.verify', 'report.payments'
)
where r.name = 'PAYMENT_ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'committee.manage', 'registration.view', 'registration.edit',
  'qr.regenerate', 'report.participants'
)
where r.name = 'REGISTRATION_ADMIN';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'registration.view', 'attendance.scan', 'attendance.correct'
)
where r.name = 'ATTENDANCE_OPERATOR';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'registration.view', 'food.scan', 'report.food'
)
where r.name = 'FOOD_OPERATOR';

insert into public.site_settings (
  id, society_name, tagline, about_html, mission_html, history_html,
  contact_email, contact_phone, contact_address, hero_stats
) values (
  true,
  'Kautilya MUN',
  'Strategy. Diplomacy. Statecraft.',
  '<p>Kautilya Model United Nations is the annual conference of our college MUN society — a forum where students debate as delegates, chairs, and members of the International Press.</p><p>Named for Chanakya (Kautilya), whose <em>Arthashastra</em> treated statecraft as a discipline of evidence and consequence, the society trains speakers who can argue, negotiate, and still hold a brief to the facts.</p>',
  '<p>To run a conference that is operationally exact — seats, payments, credentials, and logistics that do not fail under load — and intellectually serious enough that a first-time delegate leaves knowing how a resolution is actually made.</p>',
  '<p>The society has hosted successive editions of Kautilya MUN without rebuilding the platform each year. Past committees, galleries, and results remain on this site so the record of the conference outlasts any single secretariat.</p>',
  'secretariat@kautilya.local',
  '+91 90000 00000',
  'College Campus, India',
  '[{"label":"Editions hosted","value":"8+"},{"label":"Committees / year","value":"6"},{"label":"Delegates","value":"300+"}]'::jsonb
);
