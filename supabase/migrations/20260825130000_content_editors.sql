-- Content editors: public CMS + committee details. Super-admin stays unique.

insert into public.roles (name, description)
values ('CONTENT_EDITOR', 'Edit public site copy and committee details')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('cms.manage', 'committee.manage')
where r.name = 'CONTENT_EDITOR'
on conflict do nothing;
