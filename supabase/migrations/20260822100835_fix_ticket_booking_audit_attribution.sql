begin;

-- Employee PIN identities became independent HR records in
-- 20260804060910_decouple_employee_records_from_accounts.sql. Keep the signed-in
-- player profile in actor_user_id/auth_user_id (both reference profiles), while
-- operator_session_id continues to identify the employee who unlocked the kiosk.
create or replace function public.attribute_staff_kiosk_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_auth_user uuid := (select auth.uid());
  v_operator uuid := private.current_staff_kiosk_operator_profile_id();
  v_session uuid := private.current_staff_kiosk_session_id();
  v_role text := private.current_staff_kiosk_role_key();
begin
  new.auth_user_id := coalesce(new.auth_user_id, v_auth_user);
  new.actor_user_id := coalesce(v_auth_user, new.actor_user_id);

  if v_operator is not null and v_session is not null then
    new.operator_session_id := v_session;
    new.operator_role := v_role;
  end if;

  return new;
end;
$$;

revoke all on function public.attribute_staff_kiosk_audit()
from public, anon, authenticated;

comment on function public.attribute_staff_kiosk_audit() is
  'Keeps profile foreign keys tied to the authenticated account and attributes a shared-login employee through the kiosk session.';

notify pgrst, 'reload schema';

commit;
