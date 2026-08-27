-- Editors and delegate affairs may read the rest of admin (same view grants as VIEWER).
-- Mutate rights stay on their own permissions (cms/committee.content vs payments/registrations).

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
where r.name in ('CONTENT_EDITOR', 'DELEGATE_AFFAIRS')
on conflict do nothing;
