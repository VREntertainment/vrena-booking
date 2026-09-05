-- Run on the local schema-only database. Every fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

do $$ begin
  if exists (select 1 from private.integration_settings where key = 'google_sheets_webhook_url' and nullif(value, '') is not null) then
    raise exception 'Run this test on a local schema-only database without integrations.';
  end if;
end $$;

select plan(27);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select is(public.ticket_minimum_duration_minutes('cafe-des-stagiaires', date '2026-09-05', 5, 1), 45, 'Cafe five players fit 45 minutes');
select is(public.ticket_minimum_duration_minutes('cafe-des-stagiaires', date '2026-09-05', 8, 1), 45, 'Cafe eight players fit 45 minutes');
select is(public.ticket_minimum_duration_minutes('cafe-des-stagiaires', date '2026-09-05', 9, 1), 90, 'Cafe ninth player needs another block');
select is(public.ticket_minimum_duration_minutes('ha-do-centrosa', date '2026-09-05', 5, 1), 90, 'Ha Do keeps four players per arena');
select is(public.ticket_minimum_duration_minutes('ha-do-centrosa', date '2026-09-05', 8, 2), 45, 'Ha Do two arenas fit eight players');

-- Exercise the actual deployed request endpoint, including profile/session writes,
-- duration validation and price calculation, for each relevant capacity boundary.
select is(
  (public.create_cafe_ticket_booking_request('individual', current_date + 40 + players, time '16:00', duration, players, 1,
    array['revolta'], '+8499900' || lpad(players::text, 4, '0'), 'Local booking regression')->>'ticket_total_price')::integer,
  expected_total, format('Cafe endpoint accepts %s players / %s minutes with the correct price', players, duration)
)
from (values
  (1,45,240000), (4,45,960000), (5,45,1080000), (6,45,1296000),
  (7,45,1512000), (8,45,1728000), (9,90,3672000), (16,90,6528000)
) cases(players,duration,expected_total);

select throws_ok($q$select public.create_cafe_ticket_booking_request('individual', current_date + 80, time '16:00', 45, 9, 1,
  array['revolta'], '+84999000999', 'Local regression')$q$, 'P0001',
  'Ticket duration is below the minimum for the selected players and arenas.', 'Cafe rejects nine players in 45 minutes');
select throws_ok($q$select public.create_cafe_ticket_booking_request('individual', current_date + 80, time '16:00', 45, 8, 2,
  array['revolta'], '+84999000998', 'Local regression')$q$, 'P0001',
  'Cafe bookings use one arena.', 'Cafe rejects a second arena');

set local timezone = 'UTC';
select is(public.ticket_booking_start_is_past(date '2026-09-05', time '12:00', timestamptz '2026-09-05 06:00+00'), true, 'Noon Vietnam is past at 13:00 Vietnam even in UTC');
select is(public.ticket_booking_start_is_past(date '2026-09-05', time '14:00', timestamptz '2026-09-05 06:00+00'), false, '14:00 Vietnam remains in the future at 13:00');
select is(public.ticket_booking_start_is_past(date '2026-09-05', time '00:00', timestamptz '2026-09-04 17:00+00'), true, 'Exact Vietnam midnight is not bookable');
set local timezone = 'America/New_York';
select is(public.ticket_booking_start_is_past(date '2026-09-05', time '00:15', timestamptz '2026-09-04 17:00+00'), false, 'Midnight boundary is independent of database session timezone');
set local timezone = 'UTC';

select throws_ok($q$select public.create_guest_ticket_booking('individual', current_date - 1, time '16:00', 45, 1, 1,
  array['revolta'], 0, 0, '+84999000997', 'Local regression')$q$, 'P0001', 'Selected time is already past.', 'Guest Ha Do endpoint rejects a past slot');
select throws_ok($q$select public.create_cafe_ticket_booking_request('individual', current_date - 1, time '16:00', 45, 1, 1,
  array['revolta'], '+84999000996', 'Local regression')$q$, 'P0001', 'Selected time is already past.', 'Cafe endpoint rejects a past slot');
select set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok($q$select public.create_ticket_booking('individual', current_date - 1, time '16:00', 45, 1, 1,
  array['revolta'], 0, 0)$q$, 'P0001', 'Selected time is already past.', 'Authenticated Ha Do endpoint rejects a past slot');

select ok(not has_function_privilege('anon', 'public.ticket_minimum_duration_minutes(text,date,integer,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.ticket_minimum_duration_minutes(text,date,integer,integer)', 'execute'), 'Capacity helper is not exposed to browser roles');
select ok(not has_function_privilege('anon', 'public.ticket_booking_start_is_past(date,time without time zone,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.ticket_booking_start_is_past(date,time without time zone,timestamptz)', 'execute'), 'Time helper is not exposed to browser roles');
select ok(has_function_privilege('anon', 'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)', 'execute'), 'Guest Cafe endpoint retains its existing grant');
select is((select count(*)::integer from public.staff_games where slug in ('revolta','city-z','station-zarya') and active), 3, 'All advertised ANVIO games are active staff choices');
select is((select count(*)::integer from public.sessions where venue_key='cafe-des-stagiaires' and ticket_status='pending'), 8, 'Successful Cafe fixtures remain pending confirmation');

select * from finish();
rollback;
