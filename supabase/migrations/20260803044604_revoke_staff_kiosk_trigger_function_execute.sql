begin;

revoke all on function public.attribute_staff_kiosk_audit() from public, anon, authenticated;
revoke all on function public.staff_kiosk_audit_mutation() from public, anon, authenticated;

revoke all on function private.staff_kiosk_request_headers() from public, anon, authenticated;
revoke all on function private.staff_kiosk_request_token_hash() from public, anon, authenticated;
revoke all on function private.current_staff_kiosk_session_id() from public, anon, authenticated;
revoke all on function private.current_staff_kiosk_operator_profile_id() from public, anon, authenticated;
revoke all on function private.current_staff_kiosk_role_key() from public, anon, authenticated;
revoke all on function private.current_staff_kiosk_role_rank() from public, anon, authenticated;

grant execute on function public.attribute_staff_kiosk_audit() to service_role;
grant execute on function public.staff_kiosk_audit_mutation() to service_role;
grant execute on function private.staff_kiosk_request_headers() to service_role;
grant execute on function private.staff_kiosk_request_token_hash() to service_role;
grant execute on function private.current_staff_kiosk_session_id() to service_role;
grant execute on function private.current_staff_kiosk_operator_profile_id() to service_role;
grant execute on function private.current_staff_kiosk_role_key() to service_role;
grant execute on function private.current_staff_kiosk_role_rank() to service_role;

commit;
