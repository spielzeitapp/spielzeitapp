-- Platform admins: id only (no email in report automation beyond verification)
select p.id as profile_user_id, p.is_admin, ur.role as user_roles_role
from profiles p
left join user_roles ur on ur.user_id = p.id
where p.is_admin is true or lower(trim(ur.role::text)) = 'admin'
order by p.id;
