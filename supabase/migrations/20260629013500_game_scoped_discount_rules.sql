alter table public.staff_discount_rules
  add column if not exists game_id uuid references public.staff_games(id) on delete set null;

create index if not exists staff_discount_rules_game_idx
on public.staff_discount_rules (game_id)
where game_id is not null;

create or replace function public.staff_discount_rule_matches_game(
  p_rule_game_id uuid,
  p_requested_game_id text default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_rule_game_id is null
    or nullif(btrim(coalesce(p_requested_game_id, '')), '') is null
    or exists (
      select 1
      from public.staff_games g
      where g.id = p_rule_game_id
        and (
          g.id::text = btrim(coalesce(p_requested_game_id, ''))
          or lower(g.slug) = lower(btrim(coalesce(p_requested_game_id, '')))
        )
    );
$$;

create or replace function public.ticket_discount_code_quote(
  p_code text,
  p_booking_date date,
  p_subtotal integer,
  p_unit_price integer,
  p_game_id text default null
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
    and public.staff_discount_rule_matches_game(game_id, p_game_id)
  limit 1;

  if not found then
    return;
  end if;

  if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
    v_discount_amount := round(v_subtotal * least(v_discount.value, 100) / 100)::integer;
  elsif v_discount.discount_type = 'fixed_amount' then
    v_discount_amount := v_discount.value::integer;
  elsif v_discount.discount_type = 'free_ticket' then
    v_discount_amount := greatest(coalesce(p_unit_price, 0), 0);
  end if;

  v_discount_amount := least(v_subtotal, greatest(0, v_discount_amount));

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
    'where code is not null
      and lower(btrim(code)) = lower(v_discount_code)
      and active = true
      and valid_from <= p_date
      and (valid_until is null or valid_until >= p_date)
    for update;',
    'where code is not null
      and lower(btrim(code)) = lower(v_discount_code)
      and active = true
      and valid_from <= p_date
      and (valid_until is null or valid_until >= p_date)
      and public.staff_discount_rule_matches_game(game_id, coalesce(v_game_options[1], ''laser-tag''))
    for update;'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_ticket_booking discount game scope.';
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
    'where id = p_discount_rule_id
      and active = true
      and valid_from <= p_booking_date
      and (valid_until is null or valid_until >= p_booking_date)
    for update;',
    'where id = p_discount_rule_id
      and active = true
      and valid_from <= p_booking_date
      and (valid_until is null or valid_until >= p_booking_date)
      and (game_id is null or game_id = p_game_id)
    for update;'
  );

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_staff_order discount game scope.';
  end if;

  execute v_next_definition;
end $$;

revoke all on function public.staff_discount_rule_matches_game(uuid, text) from public;
revoke all on function public.ticket_discount_code_quote(text, date, integer, integer, text) from public, anon;

grant execute on function public.staff_discount_rule_matches_game(uuid, text) to authenticated, service_role;
grant execute on function public.ticket_discount_code_quote(text, date, integer, integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';
