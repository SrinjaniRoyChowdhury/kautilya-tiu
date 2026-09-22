select u.email, u.username, r.name as role
from public.users u
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) like '%admin%' or lower(u.email) like '%kautilya%'
order by 1, 3;
