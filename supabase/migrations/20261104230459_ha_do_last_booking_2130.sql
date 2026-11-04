-- Keep current function bodies, permissions and staff outside-hours overrides.
-- Fail rather than silently skipping an unexpected source definition.
do $migration$
declare r record; original text; updated text; changed integer := 0;
begin
 for r in select p.oid,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('create_guest_ticket_booking','create_ticket_booking','create_staff_order'))
 or (n.nspname='private' and p.proname in ('create_friend_challenge','create_staff_reserved_order','create_staff_reserved_order_v2','create_staff_reserved_order_v3','staff_update_calendar_booking','staff_update_sim_racing_booking','set_sim_racing_slot','sim_racing_available_times','create_sim_racing_booking'))
 loop
  original := pg_get_functiondef(r.oid);
  updated := replace(original,'v_start_minutes < 9 * 60 or v_end_minutes > 22 * 60','v_start_minutes < 9 * 60 or p_start_time > time ''21:30'' or v_end_minutes > 22 * 60');
  updated := replace(updated,'v_booking_minutes < (case when v_venue_key', '(v_venue_key = ''ha-do-centrosa'' and p_booking_time > time ''21:30'') or v_booking_minutes < (case when v_venue_key');
  updated := replace(updated,'v_start < (case when v_venue=', '(v_venue = ''ha-do-centrosa'' and v_time > time ''21:30'') or v_start < (case when v_venue=');
  updated := replace(updated,'v_time < time ''09:00'' or extract(epoch', 'v_time < time ''09:00'' or v_time > time ''21:30'' or extract(epoch');
  updated := replace(updated,'21:45','21:30');
  if updated = original then raise exception 'Expected hours validation missing in %.%',r.nspname,r.proname; end if;
  execute updated; changed := changed + 1;
 end loop;
 if changed <> 12 then raise exception 'Expected 12 hours functions; found %',changed; end if;
end $migration$;
notify pgrst, 'reload schema';
