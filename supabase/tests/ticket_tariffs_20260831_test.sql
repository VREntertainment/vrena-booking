begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select is(public.ticket_tariff_price_block_minutes(date '2026-08-30'), 20, 'legacy bookings keep 20-minute price blocks');
select is(public.ticket_tariff_price_block_minutes(date '2026-08-31'), 45, 'new tariffs use 45-minute price blocks');

select is(public.ticket_tariff_unit_price('ha-do-centrosa', 'individual', date '2026-08-31', time '09:00'), 220000, 'Ha Do weekday daytime tariff');
select is(public.ticket_tariff_unit_price('ha-do-centrosa', 'individual', date '2026-08-31', time '16:00'), 260000, 'Ha Do weekday happy-hour tariff');
select is(public.ticket_tariff_unit_price('ha-do-centrosa', 'individual', date '2026-08-31', time '20:00'), 290000, 'Ha Do weekday evening tariff');
select is(public.ticket_tariff_unit_price('ha-do-centrosa', 'individual', date '2026-09-05', time '19:59'), 330000, 'Ha Do weekend daytime tariff');
select is(public.ticket_tariff_unit_price('ha-do-centrosa', 'individual', date '2026-09-05', time '20:00'), 390000, 'Ha Do weekend evening tariff');

select is(public.ticket_tariff_unit_price('cafe-des-stagiaires', 'individual', date '2026-08-31', time '16:00'), 240000, 'CS daily 16:00 tariff');
select is(public.ticket_tariff_unit_price('cafe-des-stagiaires', 'individual', date '2026-08-31', time '20:00'), 290000, 'CS daily 20:00 tariff');
select is(public.ticket_tariff_unit_price('cafe-des-stagiaires', 'individual', date '2026-09-05', time '16:00'), 240000, 'CS weekend 16:00 tariff');
select is(public.ticket_tariff_unit_price('cafe-des-stagiaires', 'individual', date '2026-09-05', time '20:00'), 290000, 'CS weekend 20:00 tariff');
select is(public.ticket_tariff_unit_price('cafe-des-stagiaires', 'birthday', date '2026-08-31', time '16:00'), 0, 'special-event prices remain to be confirmed');

select ok(
  position('ticket_tariff_price_block_minutes(p_date)' in pg_get_functiondef(
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure
  )) > 0,
  'authenticated booking enforces date-aware price blocks'
);

select ok(
  position('ticket_tariff_unit_price' in pg_get_functiondef(
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure
  )) > 0,
  'guest booking enforces the server tariff helper'
);

select ok(
  position('v_end_minutes > 22 * 60' in pg_get_functiondef(
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure
  )) > 0,
  'CS booking requests close at 22:00'
);

select ok(
  not has_function_privilege('authenticated', 'public.ticket_tariff_price_block_minutes(date)', 'execute')
  and not has_function_privilege('anon', 'public.ticket_tariff_price_block_minutes(date)', 'execute'),
  'internal price-block helper is not a browser API'
);

select ok(
  not has_function_privilege('authenticated', 'public.ticket_tariff_unit_price(text,text,date,time without time zone)', 'execute')
  and not has_function_privilege('anon', 'public.ticket_tariff_unit_price(text,text,date,time without time zone)', 'execute'),
  'internal unit-price helper is not a browser API'
);

select * from finish();

rollback;
