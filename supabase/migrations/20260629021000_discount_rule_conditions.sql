alter table public.staff_discount_rules
  add column if not exists min_players integer check (min_players is null or min_players > 0),
  add column if not exists max_players integer check (max_players is null or max_players > 0),
  add column if not exists day_scope text not null default 'all'
    check (day_scope in ('all', 'weekday', 'weekend', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  add column if not exists time_start time,
  add column if not exists time_end time,
  add column if not exists ticket_type text not null default 'all'
    check (ticket_type in ('all', 'individual', 'birthday', 'corporate')),
  add column if not exists min_order_total integer not null default 0 check (min_order_total >= 0),
  add column if not exists max_discount_amount integer check (max_discount_amount is null or max_discount_amount >= 0),
  add column if not exists per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0);

alter table public.sessions
  add column if not exists ticket_discount_rule_id uuid references public.staff_discount_rules(id) on delete set null,
  add column if not exists ticket_discount_code text;

create index if not exists staff_discount_rules_conditions_idx
on public.staff_discount_rules (active, day_scope, ticket_type, valid_from, valid_until);

create index if not exists sessions_ticket_discount_customer_idx
on public.sessions (ticket_customer_id, ticket_discount_rule_id)
where ticket_customer_id is not null and ticket_discount_rule_id is not null;

create or replace function public.staff_discount_rule_matches_context(
  p_rule_game_id uuid,
  p_min_players integer,
  p_max_players integer,
  p_day_scope text,
  p_time_start time,
  p_time_end time,
  p_ticket_type text,
  p_min_order_total integer,
  p_per_customer_limit integer,
  p_discount_rule_id uuid,
  p_requested_game_id text default null,
  p_booking_date date default null,
  p_booking_time time default null,
  p_player_count integer default null,
  p_subtotal integer default null,
  p_requested_ticket_type text default null,
  p_customer_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day integer;
  v_scope text := coalesce(nullif(btrim(p_day_scope), ''), 'all');
  v_ticket_type text := coalesce(nullif(btrim(p_ticket_type), ''), 'all');
  v_requested_ticket_type text := coalesce(nullif(btrim(p_requested_ticket_type), ''), 'all');
  v_usage_count integer := 0;
begin
  if not public.staff_discount_rule_matches_game(p_rule_game_id, p_requested_game_id) then
    return false;
  end if;

  if p_min_players is not null and coalesce(p_player_count, 0) < p_min_players then
    return false;
  end if;

  if p_max_players is not null and coalesce(p_player_count, 0) > p_max_players then
    return false;
  end if;

  if coalesce(p_min_order_total, 0) > 0 and coalesce(p_subtotal, 0) < p_min_order_total then
    return false;
  end if;

  if v_ticket_type <> 'all' and v_ticket_type <> v_requested_ticket_type then
    return false;
  end if;

  if v_scope <> 'all' then
    if p_booking_date is null then
      return false;
    end if;

    v_day := extract(isodow from p_booking_date)::integer;
    if v_scope = 'weekday' and v_day not between 1 and 5 then
      return false;
    elsif v_scope = 'weekend' and v_day not in (6, 7) then
      return false;
    elsif v_scope = 'mon' and v_day <> 1 then
      return false;
    elsif v_scope = 'tue' and v_day <> 2 then
      return false;
    elsif v_scope = 'wed' and v_day <> 3 then
      return false;
    elsif v_scope = 'thu' and v_day <> 4 then
      return false;
    elsif v_scope = 'fri' and v_day <> 5 then
      return false;
    elsif v_scope = 'sat' and v_day <> 6 then
      return false;
    elsif v_scope = 'sun' and v_day <> 7 then
      return false;
    end if;
  end if;

  if p_time_start is not null or p_time_end is not null then
    if p_booking_time is null then
      return false;
    end if;

    if p_time_start is not null and p_time_end is not null and p_time_start > p_time_end then
      if not (p_booking_time >= p_time_start or p_booking_time < p_time_end) then
        return false;
      end if;
    elsif (p_time_start is not null and p_booking_time < p_time_start)
      or (p_time_end is not null and p_booking_time >= p_time_end) then
      return false;
    end if;
  end if;

  if p_per_customer_limit is not null and p_customer_id is not null and p_discount_rule_id is not null then
    select
      coalesce((
        select count(*)::integer
        from public.staff_orders
        where customer_id = p_customer_id
          and discount_rule_id = p_discount_rule_id
      ), 0)
      + coalesce((
        select count(*)::integer
        from public.sessions
        where ticket_customer_id = p_customer_id
          and ticket_discount_rule_id = p_discount_rule_id
      ), 0)
    into v_usage_count;

    if v_usage_count >= p_per_customer_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.staff_discount_rule_amount(
  p_discount_type text,
  p_value numeric,
  p_subtotal integer,
  p_unit_price integer,
  p_max_discount_amount integer default null
)
returns integer
language sql
stable
set search_path = public
as $$
  select least(
    greatest(0, coalesce(p_subtotal, 0)),
    greatest(
      0,
      least(
        case
          when p_discount_type in ('percentage', 'birthday', 'resident', 'group')
            then round(greatest(0, coalesce(p_subtotal, 0)) * least(greatest(coalesce(p_value, 0), 0), 100) / 100)::integer
          when p_discount_type = 'fixed_amount'
            then round(greatest(coalesce(p_value, 0), 0))::integer
          when p_discount_type = 'free_ticket'
            then greatest(coalesce(p_unit_price, 0), 0)
          else 0
        end,
        coalesce(p_max_discount_amount, 2147483647)
      )
    )
  );
$$;

drop function if exists public.ticket_discount_code_quote(text, date, integer, integer);
drop function if exists public.ticket_discount_code_quote(text, date, integer, integer, text);

create or replace function public.ticket_discount_code_quote(
  p_code text,
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer,
  p_game_id text default null,
  p_player_count integer default null,
  p_start_time time default null,
  p_ticket_type text default null
)
returns table (
  discount_code text,
  discount_name text,
  discount_amount integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_discount public.staff_discount_rules%rowtype;
  v_discount_amount integer := 0;
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if v_code is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  select *
  into v_discount
  from public.staff_discount_rules
  where code is not null
    and lower(btrim(code)) = lower(v_code)
    and active = true
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (max_uses is null or used_count < max_uses)
    and public.staff_discount_rule_matches_context(
      game_id,
      min_players,
      max_players,
      day_scope,
      time_start,
      time_end,
      ticket_type,
      min_order_total,
      per_customer_limit,
      id,
      p_game_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      auth.uid()
    )
  order by created_at desc
  limit 1;

  if not found then
    return;
  end if;

  v_discount_amount := public.staff_discount_rule_amount(
    v_discount.discount_type,
    v_discount.value,
    v_subtotal,
    p_unit_price,
    v_discount.max_discount_amount
  );

  if v_discount_amount <= 0 then
    return;
  end if;

  return query
  select v_discount.code, v_discount.name, v_discount_amount;
end;
$$;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text)'::regprocedure)
  into v_definition;

  v_next_definition := replace(
    v_definition,
    'and public.staff_discount_rule_matches_game(game_id, coalesce(v_game_options[1], ''laser-tag''))
    for update;',
    'and public.staff_discount_rule_matches_context(
        game_id,
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        coalesce(v_game_options[1], ''laser-tag''),
        p_date,
        p_start_time,
        p_player_count,
        v_expected_gross,
        p_ticket_type,
        v_user_id
      )
    for update;'
  );

  v_next_definition := replace(
    v_next_definition,
    'v_voucher_discount := least(v_expected_gross, greatest(0, v_voucher_discount));',
    'v_voucher_discount := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_expected_gross,
      v_expected_unit_price,
      v_discount.max_discount_amount
    );'
  );

  v_next_definition := replace(
    v_next_definition,
    'ticket_customer_id
  ) values (',
    'ticket_customer_id,
    ticket_discount_rule_id,
    ticket_discount_code
  ) values ('
  );

  v_next_definition := replace(
    v_next_definition,
    'v_user_id
  )
  returning id into v_session_id;',
    'v_user_id,
    case when v_discount_source = ''voucher'' then v_discount.id else null end,
    v_applied_discount_code
  )
  returning id into v_session_id;'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking discount rule conditions.';
  end if;

  execute v_next_definition;
end $$;

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_staff_order(uuid,text,text,text,uuid,date,time,integer,text,uuid,text,text,text,boolean,text,text,text,text,text,text,numeric)'::regprocedure)
  into v_definition;

  v_next_definition := replace(
    v_definition,
    'and (game_id is null or game_id = p_game_id)
    for update;',
    'and public.staff_discount_rule_matches_context(
        game_id,
        min_players,
        max_players,
        day_scope,
        time_start,
        time_end,
        ticket_type,
        min_order_total,
        per_customer_limit,
        id,
        p_game_id::text,
        p_booking_date,
        p_booking_time,
        p_players_count,
        v_subtotal,
        ''all'',
        p_customer_id
      )
    for update;'
  );

  v_next_definition := replace(
    v_next_definition,
    'v_discount_total := least(v_subtotal, greatest(0, v_discount_total));

    update public.staff_discount_rules',
    'v_discount_total := public.staff_discount_rule_amount(
      v_discount.discount_type,
      v_discount.value,
      v_subtotal,
      coalesce(v_rule.price_per_player, 0),
      v_discount.max_discount_amount
    );

    update public.staff_discount_rules'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_staff_order discount rule conditions.';
  end if;

  execute v_next_definition;
end $$;

revoke all on function public.staff_discount_rule_matches_context(uuid, integer, integer, text, time, time, text, integer, integer, uuid, text, date, time, integer, integer, text, uuid) from public;
revoke all on function public.staff_discount_rule_amount(text, numeric, integer, integer, integer) from public;
revoke all on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) from public, anon;

grant execute on function public.staff_discount_rule_matches_context(uuid, integer, integer, text, time, time, text, integer, integer, uuid, text, date, time, integer, integer, text, uuid) to authenticated, service_role;
grant execute on function public.staff_discount_rule_amount(text, numeric, integer, integer, integer) to authenticated, service_role;
grant execute on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) to authenticated, service_role;

notify pgrst, 'reload schema';
