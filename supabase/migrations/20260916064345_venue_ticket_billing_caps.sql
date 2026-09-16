begin;

create or replace function public.ticket_minimum_duration_minutes(
  p_venue_key text, p_date date, p_player_count integer, p_arena_count integer
) returns integer language sql immutable strict set search_path = '' as $$
  select ceil(p_player_count::numeric / (
    p_arena_count * case when p_venue_key = 'cafe-des-stagiaires' then 8 else 4 end
    * case when p_date >= date '2026-08-31' then 2 else 1 end
  ))::integer * public.ticket_tariff_price_block_minutes(p_date);
$$;

-- Keep historical 20-minute tariffs intact. Current bookings cap billed players
-- independently from guest count; discounts use capped billed players multiplied by booked blocks.
create or replace function public.ticket_billed_players_per_block(
  p_venue_key text, p_date date, p_player_count integer, p_arena_count integer
) returns integer language sql immutable strict set search_path = '' as $$
  select case when p_date < date '2026-08-31' then p_player_count else
    least(p_player_count, p_arena_count * case when p_venue_key = 'cafe-des-stagiaires' then 8 else 4 end)
  end;
$$;
revoke all on function public.ticket_billed_players_per_block(text,date,integer,integer) from public, anon, authenticated;

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
  v_venue text;
begin
  foreach v_signature in array array[
    'public.create_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,integer,text,text)'::regprocedure,
    'public.create_guest_ticket_booking(text,date,time without time zone,integer,integer,integer,text[],integer,integer,text,text,text)'::regprocedure,
    'public.create_cafe_ticket_booking_request(text,date,time without time zone,integer,integer,integer,text[],text,text,text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_venue := case when v_signature::text like '%create_cafe_ticket_booking_request%'
      then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;

    v_before := v_definition;
    v_definition := replace(v_definition,
      $old$if p_player_count < 1
    or (p_ticket_type = 'corporate' and p_player_count > 32)
    or (p_ticket_type <> 'corporate' and p_player_count > 16)
  then$old$,
      format($new$if p_player_count is null or p_player_count < 1 or p_player_count > 16
    or p_arena_count is null or p_player_count > p_arena_count * %s
  then$new$, case when v_venue = 'cafe-des-stagiaires' then 16 else 8 end));
    if v_definition = v_before then raise exception 'Expected player validation missing in %', v_signature; end if;

    v_before := v_definition;
    if v_venue = 'cafe-des-stagiaires' then
      v_definition := replace(v_definition,
        '(v_expected_unit_price * v_duration_blocks * p_player_count)::numeric',
        '(v_expected_unit_price * v_duration_blocks * public.ticket_billed_players_per_block(''cafe-des-stagiaires'', p_date, p_player_count, p_arena_count))::numeric');
    else
      v_definition := replace(v_definition,
        'v_charged_players_per_block := p_player_count;',
        'v_charged_players_per_block := public.ticket_billed_players_per_block(''ha-do-centrosa'', p_date, p_player_count, p_arena_count);');
    end if;
    if v_definition = v_before then raise exception 'Expected billing calculation missing in %', v_signature; end if;

    if v_signature::text like '%public.create_ticket_booking(%' or v_signature::text like 'create_ticket_booking(%' then
      v_before := v_definition;
      v_definition := replace(v_definition,
        'v_auto_discount := coalesce(v_auto_discount, 0);',
        $new$v_auto_discount := coalesce(v_auto_discount, 0);
  -- Match the browser's built-in billed-slot discount even when no configured
  -- automatic rule matches. Other offers retain the existing best-offer policy.
  if p_ticket_type = 'individual' and round(v_expected_gross * case
    when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 9 and 16 then 0.15
    when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 5 and 8 then 0.10 else 0 end)::integer > v_auto_discount then
    v_auto_discount := round(v_expected_gross * case
      when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 9 and 16 then 0.15
      when (case when p_date < date '2026-08-31' then p_player_count else v_charged_player_spots end) between 5 and 8 then 0.10 else 0 end)::integer;
    v_auto_discount_rule_id := null;
  end if;$new$);
      if v_definition = v_before then raise exception 'Expected automatic discount calculation missing'; end if;
    end if;
    -- Guest endpoints use the same billed-slot discount tiers as the client.
    if v_venue = 'cafe-des-stagiaires' then
      v_definition := replace(v_definition, 'if p_player_count > 8 then',
        'if (v_duration_blocks * public.ticket_billed_players_per_block(''cafe-des-stagiaires'', p_date, p_player_count, p_arena_count)) between 9 and 16 then');
      v_definition := replace(v_definition, 'elsif p_player_count > 4 then',
        'elsif (v_duration_blocks * public.ticket_billed_players_per_block(''cafe-des-stagiaires'', p_date, p_player_count, p_arena_count)) between 5 and 8 then');
    elsif v_signature::text like '%create_guest_ticket_booking%' then
      v_definition := replace(v_definition, 'if p_player_count > 8 then',
        'if (case when p_date < date ''2026-08-31'' then p_player_count else v_charged_player_spots end) between 9 and 16 then');
      v_definition := replace(v_definition, 'elsif p_player_count > 4 then',
        'elsif (case when p_date < date ''2026-08-31'' then p_player_count else v_charged_player_spots end) between 5 and 8 then');
    end if;
    execute v_definition;
  end loop;
end;
$migration$;

-- Existing configured group offers must use the same billed-slot eligibility
-- during both quotation and atomic claiming. Voucher and birthday rules retain
-- their existing eligibility and best-offer behavior.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
  v_prefix text;
begin
  foreach v_signature in array array[
    'public.ticket_automatic_discount_quote(date,integer,integer,text,integer,time without time zone,text)'::regprocedure,
    'public.claim_ticket_automatic_discount(uuid,date,integer,integer,text,integer,time without time zone,text,uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_prefix := case when v_signature::text like '%claim_ticket%' then '' else 'd.' end;
    v_before := v_definition;
    v_definition := replace(v_definition,
      E'      p_start_time,\n      p_player_count,\n      v_subtotal,',
      format(E'      p_start_time,\n      case when p_booking_date >= date ''2026-08-31'' and p_unit_price > 0\n        and (%1$sdiscount_type = ''group'' or (%1$sdiscount_type = ''percentage'' and\n          ((%1$smin_players = 5 and %1$smax_players = 8 and %1$svalue = 10) or\n           (%1$smin_players = 9 and %1$smax_players = 16 and %1$svalue = 15))))\n        then v_subtotal / p_unit_price else p_player_count end,\n      v_subtotal,', v_prefix));
    if v_definition = v_before then raise exception 'Expected discount eligibility missing in %', v_signature; end if;
    execute v_definition;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
