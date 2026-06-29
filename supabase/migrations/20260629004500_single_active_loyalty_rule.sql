create or replace function public.staff_loyalty_rule_matches_game(
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

with ranked as (
  select
    id,
    row_number() over (order by updated_at desc, created_at desc, id desc) as active_rank
  from public.staff_loyalty_rules
  where active = true
)
update public.staff_loyalty_rules rules
set active = false,
    updated_at = now()
from ranked
where rules.id = ranked.id
  and ranked.active_rank > 1;

create or replace function public.ensure_single_active_loyalty_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.active = true then
    update public.staff_loyalty_rules
    set active = false,
        updated_at = now()
    where active = true
      and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists staff_loyalty_rules_single_active on public.staff_loyalty_rules;
create trigger staff_loyalty_rules_single_active
before insert or update of active on public.staff_loyalty_rules
for each row execute function public.ensure_single_active_loyalty_rule();

create unique index if not exists staff_loyalty_rules_one_active_idx
on public.staff_loyalty_rules (active)
where active = true;

create or replace function public.ticket_loyalty_redemption_settings(
  p_game_id text default null,
  p_booking_date date default current_date
)
returns table (
  loyalty_points_total integer,
  redeem_value_vnd_per_point integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Login required.';
  end if;

  return query
  select
    coalesce(p.loyalty_points_total, 0)::integer as loyalty_points_total,
    coalesce((
      select r.redeem_value_vnd_per_point
      from public.staff_loyalty_rules r
      where r.active = true
        and r.redeem_value_vnd_per_point > 0
        and r.valid_from <= coalesce(p_booking_date, current_date)
        and (r.valid_until is null or r.valid_until >= coalesce(p_booking_date, current_date))
        and public.staff_loyalty_rule_matches_game(r.game_id, p_game_id)
      order by r.updated_at desc, r.created_at desc
      limit 1
    ), 0)::integer as redeem_value_vnd_per_point
  from public.profiles p
  where p.id = v_user_id
    and p.deleted_at is null;
end;
$$;

create or replace function public.ticket_loyalty_earn_quote(
  p_game_id text default null,
  p_booking_date date default current_date,
  p_paid_total integer default 0,
  p_player_count integer default 1
)
returns table (
  estimated_points integer,
  estimated_reduction_vnd integer,
  redeem_value_vnd_per_point integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_paid_total integer := greatest(0, coalesce(p_paid_total, 0));
  v_player_count integer := greatest(0, coalesce(p_player_count, 0));
  v_booking_date date := coalesce(p_booking_date, current_date);
  v_points integer := 0;
  v_redeem_value integer := 0;
  v_rule public.staff_loyalty_rules%rowtype;
begin
  if v_user_id is null then
    raise exception 'Login required.';
  end if;

  select *
  into v_rule
  from public.staff_loyalty_rules
  where active = true
    and earn_trigger = 'session_payment_confirmed'
    and valid_from <= v_booking_date
    and (valid_until is null or valid_until >= v_booking_date)
    and public.staff_loyalty_rule_matches_game(game_id, p_game_id)
    and v_paid_total >= min_order_total
  order by updated_at desc, created_at desc
  limit 1;

  if found then
    v_points := greatest(0, coalesce(case v_rule.calculation_type
      when 'per_vnd_spent' then floor((v_paid_total::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(v_player_count::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end, 0));
  end if;

  select coalesce(r.redeem_value_vnd_per_point, 0)
  into v_redeem_value
  from public.staff_loyalty_rules r
  where r.active = true
    and r.redeem_value_vnd_per_point > 0
    and r.valid_from <= v_booking_date
    and (r.valid_until is null or r.valid_until >= v_booking_date)
    and public.staff_loyalty_rule_matches_game(r.game_id, p_game_id)
  order by r.updated_at desc, r.created_at desc
  limit 1;

  return query
  select
    v_points::integer,
    (v_points * coalesce(v_redeem_value, 0))::integer,
    coalesce(v_redeem_value, 0)::integer;
end;
$$;

do $$
declare
  v_function_definition text;
begin
  select pg_get_functiondef('public.create_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, integer, text)'::regprocedure)
  into v_function_definition;

  if position('and (r.game_id is null or r.game_id = coalesce(v_game_options[1], ''laser-tag''));' in v_function_definition) = 0 then
    raise exception 'Expected ticket loyalty game comparison was not found.';
  end if;

  v_function_definition := replace(
    v_function_definition,
    'and (r.game_id is null or r.game_id = coalesce(v_game_options[1], ''laser-tag''));',
    'and public.staff_loyalty_rule_matches_game(r.game_id, coalesce(v_game_options[1], ''laser-tag''));'
  );

  execute v_function_definition;
end;
$$;

revoke all on function public.ensure_single_active_loyalty_rule() from public, anon, authenticated;
revoke all on function public.staff_loyalty_rule_matches_game(uuid, text) from public, anon;
revoke all on function public.ticket_loyalty_redemption_settings(text, date) from public, anon;
revoke all on function public.ticket_loyalty_earn_quote(text, date, integer, integer) from public, anon;

grant execute on function public.staff_loyalty_rule_matches_game(uuid, text) to authenticated, service_role;
grant execute on function public.ticket_loyalty_redemption_settings(text, date) to authenticated, service_role;
grant execute on function public.ticket_loyalty_earn_quote(text, date, integer, integer) to authenticated, service_role;
