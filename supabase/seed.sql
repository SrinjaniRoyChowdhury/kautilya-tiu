-- Local / demo seed. Safe to re-run after `supabase db reset`.
-- Default admin is ONLY for local development — change the password before any shared deploy.

do $$
declare
  v_admin_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_delegate_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_edition_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_super_admin_role uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id,
    'authenticated',
    'authenticated',
    'admin@kautilya.local',
    crypt('KautilyaAdmin!26', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Secretariat Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_admin_id,
    v_admin_id,
    v_admin_id::text,
    jsonb_build_object(
      'sub', v_admin_id::text,
      'email', 'admin@kautilya.local',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ) on conflict (id) do nothing;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_delegate_id,
    'authenticated',
    'authenticated',
    'delegate@kautilya.local',
    crypt('Delegate!26', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Aarav Mehra"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_delegate_id,
    v_delegate_id,
    v_delegate_id::text,
    jsonb_build_object(
      'sub', v_delegate_id::text,
      'email', 'delegate@kautilya.local',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ) on conflict (id) do nothing;

  select r.id into v_super_admin_role from public.roles r where r.name = 'SUPER_ADMIN';

  insert into public.user_roles (user_id, role_id, edition_id)
  select v_admin_id, v_super_admin_role, null
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_admin_id
      and ur.role_id = v_super_admin_role
      and ur.edition_id is null
  );

  insert into public.mun_editions (
    id, name, year, slug, theme, start_date, end_date,
    registration_open_at, registration_close_at, status,
    is_public_active, created_by
  ) values (
    v_edition_id,
    'Kautilya MUN 2026',
    2026,
    '2026',
    'The Arithmetic of Power',
    '2026-11-13',
    '2026-11-15',
    '2026-08-01 00:00:00+05:30',
    '2026-11-01 23:59:00+05:30',
    'PUBLISHED',
    true,
    v_admin_id
  ) on conflict (id) do nothing;

  insert into public.committees (
    edition_id, name, short_name, slug, description, capacity,
    fee_minor, status, display_order, eb_json, portfolio_config
  ) values
    (
      v_edition_id,
      'United Nations Security Council',
      'UNSC',
      'unsc',
      'The principal organ charged with the maintenance of international peace and security. Double-delegate optional. Crisis elements may be introduced by the dais.',
      30,
      180000,
      'OPEN',
      1,
      '[{"name":"Chair","title":"Chairperson"},{"name":"Vice Chair","title":"Vice Chairperson"}]'::jsonb,
      '[{"name":"United States"},{"name":"China"},{"name":"Russian Federation"},{"name":"United Kingdom"},{"name":"France"},{"name":"India"}]'::jsonb
    ),
    (
      v_edition_id,
      'United Nations Human Rights Council',
      'UNHRC',
      'unhrc',
      'A working council on civil and political rights, humanitarian access, and the machinery of international accountability.',
      40,
      150000,
      'OPEN',
      2,
      '[{"name":"Chair","title":"Chairperson"}]'::jsonb,
      '[]'::jsonb
    ),
    (
      v_edition_id,
      'Disarmament and International Security',
      'DISEC',
      'disec',
      'First Committee. Conventional arms, emerging dual-use technologies, and the outer-space security file.',
      45,
      150000,
      'OPEN',
      3,
      '[{"name":"Chair","title":"Chairperson"}]'::jsonb,
      '[]'::jsonb
    ),
    (
      v_edition_id,
      'Economic and Social Council',
      'ECOSOC',
      'ecosoc',
      'Trade, development finance, and the political economy of climate adaptation.',
      40,
      140000,
      'OPEN',
      4,
      '[{"name":"Chair","title":"Chairperson"}]'::jsonb,
      '[]'::jsonb
    ),
    (
      v_edition_id,
      'All India Political Parties Meet',
      'AIPPM',
      'aippm',
      'An Indian political simulation. Delegates represent party high commands rather than UN member states.',
      50,
      160000,
      'OPEN',
      5,
      '[{"name":"Moderator","title":"Moderator"}]'::jsonb,
      '[]'::jsonb
    ),
    (
      v_edition_id,
      'International Press',
      'IP',
      'ip',
      'Reporters, photographers, and editors covering the conference. Separate application criteria apply.',
      20,
      120000,
      'OPEN',
      6,
      '[{"name":"Editor-in-Chief","title":"Editor-in-Chief"}]'::jsonb,
      '[]'::jsonb
    )
  on conflict (edition_id, short_name) do nothing;

  insert into public.registration_field_definitions (
    edition_id, field_key, label, field_type, required, options, validation, display_order, section
  ) values
    (v_edition_id, 'institution', 'Institution / College', 'text', true, null, '{"min":2,"max":120}'::jsonb, 1, 'PERSONAL'),
    (v_edition_id, 'year_of_study', 'Year of study', 'select', true, '["1","2","3","4","5","Other"]'::jsonb, null, 2, 'PERSONAL'),
    (v_edition_id, 'emergency_contact', 'Emergency contact number', 'text', true, null, '{"regex":"^[0-9+]{8,15}$"}'::jsonb, 3, 'PERSONAL'),
    (v_edition_id, 'mun_experience', 'Prior MUN experience', 'select', true, '["None","1–3 conferences","4–8 conferences","9+ conferences"]'::jsonb, null, 4, 'MUN_INFO'),
    (v_edition_id, 'portfolio_pref_1', 'Country / portfolio preference 1', 'text', false, null, null, 5, 'MUN_INFO'),
    (v_edition_id, 'portfolio_pref_2', 'Country / portfolio preference 2', 'text', false, null, null, 6, 'MUN_INFO'),
    (v_edition_id, 'dietary_notes', 'Dietary notes (allergies, etc.)', 'text', false, null, '{"max":240}'::jsonb, 7, 'FOOD'),
    (v_edition_id, 'accommodation', 'Need accommodation assistance?', 'boolean', false, null, null, 8, 'ADDITIONAL')
  on conflict (edition_id, field_key) do nothing;

  insert into public.meal_types (edition_id, name, display_order) values
    (v_edition_id, 'Breakfast', 1),
    (v_edition_id, 'Lunch', 2),
    (v_edition_id, 'Snacks', 3),
    (v_edition_id, 'Dinner', 4)
  on conflict (edition_id, name) do nothing;

  insert into public.meal_schedules (edition_id, event_day, meal_type_id)
  select mt.edition_id, d.day, mt.id
  from (values (1), (2), (3)) as d(day)
  cross join public.meal_types mt
  where mt.edition_id = v_edition_id
  on conflict do nothing;

  insert into public.announcements (edition_id, title, body_html, published, published_at, display_order)
  values
    (
      v_edition_id,
      'Registrations open for Kautilya MUN 2026',
      '<p>Individual registration is now open. Committee fees are listed on the committees page. One person may pay for several delegates after each person has (or will have) their own registration.</p>',
      true,
      now(),
      1
    ),
    (
      v_edition_id,
      'Study guides will be released in October',
      '<p>Background guides will be published to registered delegates six weeks before committee. Watch this page and your email.</p>',
      true,
      now(),
      2
    );

  insert into public.cms_team_members (edition_id, full_name, role_title, bio, display_order, published)
  values
    (null, 'Secretariat', 'Secretary-General', 'Overall conference direction, external representation, and final authority on rules of procedure.', 1, true),
    (null, 'Directorate', 'Director-General', 'Committee pedagogy, crisis notes, and dais briefing.', 2, true),
    (null, 'Finance & Ops', 'USG Administration', 'Registrations, payments, venue logistics, attendance, and food.', 3, true),
    (null, 'Delegate Affairs', 'USG Delegate Experience', 'Allocations, correspondence, and on-ground helpdesks.', 4, true);

  insert into public.payment_instructions (
    edition_id, upi_id, bank_name, account_name, account_number, ifsc, notes
  ) values (
    v_edition_id,
    'kautilyamun@upi',
    'State Bank of India',
    'Kautilya MUN Society',
    'XXXXXXXXXXXX',
    'SBIN0000000',
    'Transfer the exact expected amount. Upload the screenshot from your dashboard. Do not pay twice for the same email.'
  ) on conflict (edition_id) do nothing;
end $$;
