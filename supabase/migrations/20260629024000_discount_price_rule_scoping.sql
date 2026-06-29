alter table public.staff_discount_rules
  add column if not exists price_rule_id uuid references public.staff_pricing_rules(id) on delete set null;

create index if not exists staff_discount_rules_price_rule_idx
on public.staff_discount_rules (price_rule_id)
where price_rule_id is not null;

create or replace function public.staff_ticket_price_rule_id(
  p_game_id text default null,
  p_booking_date date default null,
  p_booking_time time default null
)
returns uuid
language sql
stable
set search_path = public
as $$
  select r.id
  from public.staff_pricing_rules r
  where r.active = true
    and r.valid_from <= coalesce(p_booking_date, current_date)
    and (r.valid_until is null or r.valid_until >= coalesce(p_booking_date, current_date))
    and public.staff_discount_rule_matches_game(r.game_id, p_game_id)
    and (
      r.day_type = 'custom'
      or (r.day_type = 'holiday' and coalesce(p_booking_date, current_date) between r.valid_from and coalesce(r.valid_until, r.valid_from))
      or (r.day_type = 'weekend' and extract(isodow from coalesce(p_booking_date, current_date)) in (6, 7))
      or (r.day_type = 'weekday' and extract(isodow from coalesce(p_booking_date, current_date)) between 1 and 5)
    )
    and (
      (p_booking_time is null and r.time_start is null and r.time_end is null)
      or (
        p_booking_time is not null
        and (r.time_start is null or p_booking_time >= r.time_start)
        and (r.time_end is null or p_booking_time < r.time_end)
      )
    )
  order by
    case when r.game_id is not null then 0 else 1 end,
    case when r.day_type in ('custom', 'holiday') then 0 else 1 end,
    r.valid_from desc,
    r.created_at desc
  limit 1;
$$;

create or replace function public.staff_discount_rule_matches_context(
  p_rule_game_id uuid,
  p_rule_price_rule_id uuid,
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
  p_requested_price_rule_id uuid default null,
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

  if p_rule_price_rule_id is not null and p_rule_price_rule_id is distinct from p_requested_price_rule_id then
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

create or replace function public.ticket_automatic_discount_quote(
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer,
  p_game_id text default null,
  p_player_count integer default null,
  p_start_time time default null,
  p_ticket_type text default null
)
returns table (
  discount_rule_id uuid,
  discount_name text,
  discount_amount integer,
  price_rule_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subtotal integer := greatest(0, coalesce(p_subtotal, 0));
  v_requested_price_rule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

  return query
  select
    d.id,
    d.name,
    public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount),
    v_requested_price_rule_id
  from public.staff_discount_rules d
  where d.code is null
    and d.active = true
    and d.valid_from <= p_booking_date
    and (d.valid_until is null or d.valid_until >= p_booking_date)
    and (d.max_uses is null or d.used_count < d.max_uses)
    and public.staff_discount_rule_matches_context(
      d.game_id,
      d.price_rule_id,
      d.min_players,
      d.max_players,
      d.day_scope,
      d.time_start,
      d.time_end,
      d.ticket_type,
      d.min_order_total,
      d.per_customer_limit,
      d.id,
      p_game_id,
      v_requested_price_rule_id,
      p_booking_date,
      p_start_time,
      p_player_count,
      v_subtotal,
      p_ticket_type,
      auth.uid()
    )
    and public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount) > 0
  order by
    public.staff_discount_rule_amount(d.discount_type, d.value, v_subtotal, p_unit_price, d.max_discount_amount) desc,
    d.created_at desc
  limit 1;
end;
$$;

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
  v_requested_price_rule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;

  if v_code is null or p_booking_date is null or v_subtotal <= 0 then
    return;
  end if;

  v_requested_price_rule_id := public.staff_ticket_price_rule_id(p_game_id, p_booking_date, p_start_time);

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
      price_rule_id,
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
      v_requested_price_rule_id,
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

insert into public.staff_discount_rules (
  code,
  name,
  discount_type,
  value,
  min_players,
  max_players,
  day_scope,
  ticket_type,
  min_order_total,
  valid_from,
  active
)
select
  seed.code,
  seed.name,
  seed.discount_type,
  seed.value,
  seed.min_players,
  seed.max_players,
  seed.day_scope,
  seed.ticket_type,
  0,
  date '2020-01-01',
  true
from (
  values
    (null::text, 'Group 5-8 players', 'percentage', 10::numeric, 5, 8, 'all', 'all'),
    (null::text, 'Group 9-16 players', 'percentage', 15::numeric, 9, 16, 'all', 'all'),
    (null::text, 'Birthday offer', 'percentage', 10::numeric, null::integer, null::integer, 'all', 'birthday')
) as seed(code, name, discount_type, value, min_players, max_players, day_scope, ticket_type)
where not exists (
  select 1
  from public.staff_discount_rules existing
  where existing.code is null
    and lower(existing.name) = lower(seed.name)
);

do $$
declare
  v_definition text;
  v_next_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,integer,text)'::regprocedure)
  into v_definition;

  v_next_definition := replace(
    v_definition,
    'v_auto_discount integer := 0;',
    'v_auto_discount integer := 0;
  v_auto_discount_rule_id uuid := null;'
  );

  v_next_definition := replace(
    v_next_definition,
    'if p_player_count > 8 then
    v_auto_discount_rate := 0.15;
  elsif p_player_count > 4 then
    v_auto_discount_rate := 0.10;
  end if;

  if p_ticket_type = ''birthday'' then
    v_auto_discount_rate := greatest(v_auto_discount_rate, 0.10);
  end if;

  v_auto_discount := least(v_expected_gross, greatest(0, round(v_expected_gross * v_auto_discount_rate)::integer));',
    'select quote.discount_rule_id, quote.discount_amount
  into v_auto_discount_rule_id, v_auto_discount
  from public.ticket_automatic_discount_quote(
    p_date,
    v_expected_gross,
    v_expected_unit_price,
    coalesce(v_game_options[1], ''laser-tag''),
    p_player_count,
    p_start_time,
    p_ticket_type
  ) as quote
  limit 1;

  v_auto_discount := coalesce(v_auto_discount, 0);'
  );

  v_next_definition := replace(
    v_next_definition,
    'and public.staff_discount_rule_matches_context(
        game_id,
        min_players,',
    'and public.staff_discount_rule_matches_context(
        game_id,
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], ''laser-tag''), p_date, p_start_time),
        min_players,'
  );

  v_next_definition := replace(
    v_next_definition,
    'coalesce(v_game_options[1], ''laser-tag''),
        p_date,
        p_start_time,',
    'coalesce(v_game_options[1], ''laser-tag''),
        public.staff_ticket_price_rule_id(coalesce(v_game_options[1], ''laser-tag''), p_date, p_start_time),
        p_date,
        p_start_time,'
  );

  v_next_definition := replace(
    v_next_definition,
    'if v_discount_source = ''voucher'' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  end if;',
    'if v_discount_source = ''voucher'' then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  elsif v_auto_discount_rule_id is not null and v_auto_discount > 0 then
    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_auto_discount_rule_id;
  end if;'
  );

  v_next_definition := replace(
    v_next_definition,
    'case when v_discount_source = ''voucher'' then v_discount.id else null end,
    v_applied_discount_code',
    'case
      when v_discount_source = ''voucher'' then v_discount.id
      when v_auto_discount_rule_id is not null and v_auto_discount > 0 then v_auto_discount_rule_id
      else null
    end,
    v_applied_discount_code'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking for price-rule scoped discounts.';
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
    'and public.staff_discount_rule_matches_context(
        game_id,
        min_players,',
    'and public.staff_discount_rule_matches_context(
        game_id,
        v_rule.id,
        min_players,'
  );

  v_next_definition := replace(
    v_next_definition,
    'p_game_id::text,
        p_booking_date,
        p_booking_time,',
    'p_game_id::text,
        v_rule.id,
        p_booking_date,
        p_booking_time,'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_staff_order for price-rule scoped discounts.';
  end if;

  execute v_next_definition;
end $$;

revoke all on function public.staff_ticket_price_rule_id(text, date, time) from public;
revoke all on function public.staff_discount_rule_matches_context(uuid, uuid, integer, integer, text, time, time, text, integer, integer, uuid, text, uuid, date, time, integer, integer, text, uuid) from public;
revoke all on function public.ticket_automatic_discount_quote(date, integer, integer, text, integer, time, text) from public, anon;
revoke all on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) from public, anon;

grant execute on function public.staff_ticket_price_rule_id(text, date, time) to authenticated, service_role;
grant execute on function public.staff_discount_rule_matches_context(uuid, uuid, integer, integer, text, time, time, text, integer, integer, uuid, text, uuid, date, time, integer, integer, text, uuid) to authenticated, service_role;
grant execute on function public.ticket_automatic_discount_quote(date, integer, integer, text, integer, time, text) to authenticated, service_role;
grant execute on function public.ticket_discount_code_quote(text, date, integer, integer, text, integer, time, text) to authenticated, service_role;

notify pgrst, 'reload schema';
