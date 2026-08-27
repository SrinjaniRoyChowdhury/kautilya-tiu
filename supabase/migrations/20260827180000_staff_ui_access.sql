-- Restrict managed staff roles to the intended admin surfaces.
-- Editors may update public committee copy (name, description, logo, EB) via committee.content.

insert into public.permissions (code, description)
values ('committee.content', 'Edit public committee name, description, logo, and executive board')
on conflict (code) do nothing;

alter table public.committees
  add column if not exists logo_url text;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'CONTENT_EDITOR'
  and p.code = 'committee.manage';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'committee.content'
where r.name in ('SUPER_ADMIN', 'ADMIN', 'CONTENT_EDITOR')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'payment.verify',
  'report.export',
  'report.payments'
)
where r.name = 'DELEGATE_AFFAIRS'
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'ATTENDANCE_OPERATOR'
  and p.code = 'attendance.correct';

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'FOOD_OPERATOR'
  and p.code = 'report.food';

-- Viewers may read venue logs without scan or correction rights.
drop policy if exists attendance_select_reports on public.attendance;
create policy attendance_select_reports on public.attendance
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (
          public.has_permission('report.export', r.edition_id)
          or public.has_permission('report.participants', r.edition_id)
          or public.has_permission('audit.view', r.edition_id)
        )
    )
  );

drop policy if exists food_select_reports on public.food_distribution;
create policy food_select_reports on public.food_distribution
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id
        and (
          public.has_permission('report.export', r.edition_id)
          or public.has_permission('report.food', r.edition_id)
        )
    )
  );

drop policy if exists collectives_mutate on public.collectives;
create policy collectives_mutate on public.collectives
  for all using (public.has_permission('edition.manage'))
  with check (public.has_permission('edition.manage'));
