begin;
create or replace function private.staff_booking_session_minutes(p_booking_date date)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_staff_console_user(50) then raise exception 'Staff access required.'; end if;
  return public.ticket_tariff_price_block_minutes(p_booking_date);
end $$;
revoke all on function private.staff_booking_session_minutes(date) from public,anon;
grant execute on function private.staff_booking_session_minutes(date) to authenticated;
create or replace function public.staff_booking_session_minutes(p_booking_date date)
returns integer language sql stable security invoker set search_path = '' as $$ select private.staff_booking_session_minutes(p_booking_date); $$;
revoke all on function public.staff_booking_session_minutes(date) from public,anon;
grant execute on function public.staff_booking_session_minutes(date) to authenticated;
notify pgrst,'reload schema';
commit;
