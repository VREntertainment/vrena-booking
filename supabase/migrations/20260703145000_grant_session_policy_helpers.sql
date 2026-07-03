begin;

grant execute on function public.can_manage_session_row(uuid) to authenticated, service_role;
grant execute on function public.can_view_session_row(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
