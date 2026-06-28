alter table public.staff_loyalty_rules
  add column if not exists redeem_value_vnd_per_point integer not null default 0
    check (redeem_value_vnd_per_point >= 0),
  add column if not exists earn_trigger text not null default 'session_payment_confirmed'
    check (earn_trigger in ('session_payment_confirmed')),
  add column if not exists rounding_rule text not null default 'floor_whole_points'
    check (rounding_rule in ('floor_whole_points'));

alter table public.profiles
  add column if not exists loyalty_points_total integer not null default 0
    check (loyalty_points_total >= 0);

grant select (loyalty_points_total) on public.profiles to anon, authenticated;

create or replace function public.protect_profile_loyalty_points_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.loyalty_points_total is distinct from new.loyalty_points_total
    and current_user <> 'service_role'
    and not public.is_staff_console_user(50)
  then
    raise exception 'Staff access required to edit loyalty points.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_loyalty_points_total on public.profiles;
create trigger profiles_protect_loyalty_points_total
before update of loyalty_points_total on public.profiles
for each row execute function public.protect_profile_loyalty_points_total();

create table if not exists public.loyalty_point_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rule_id uuid references public.staff_loyalty_rules(id) on delete set null,
  points_delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  source_type text not null check (source_type in ('staff_order', 'manual_adjustment')),
  source_id uuid,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_point_transactions_profile_idx
on public.loyalty_point_transactions (profile_id, created_at desc);

create unique index if not exists loyalty_point_transactions_auto_source_idx
on public.loyalty_point_transactions (profile_id, source_type, source_id, rule_id)
where source_type = 'staff_order' and source_id is not null;

alter table public.loyalty_point_transactions enable row level security;

grant select, insert on public.loyalty_point_transactions to authenticated;
grant all on public.loyalty_point_transactions to service_role;

drop policy if exists "loyalty transactions own read" on public.loyalty_point_transactions;
create policy "loyalty transactions own read"
on public.loyalty_point_transactions
for select
to authenticated
using (profile_id = (select auth.uid()) or public.is_staff_console_user(20));

drop policy if exists "loyalty transactions staff insert" on public.loyalty_point_transactions;
create policy "loyalty transactions staff insert"
on public.loyalty_point_transactions
for insert
to authenticated
with check (public.is_staff_console_user(50));

create or replace function public.apply_loyalty_points_delta(
  p_profile_id uuid,
  p_points_delta integer,
  p_rule_id uuid default null,
  p_source_type text default 'manual_adjustment',
  p_source_id uuid default null,
  p_reason text default null,
  p_created_by uuid default null
)
returns table (
  profile_id uuid,
  loyalty_points_total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if p_points_delta = 0 then
    return query
    select profiles.id, profiles.loyalty_points_total
    from public.profiles
    where profiles.id = p_profile_id;
    return;
  end if;

  select profiles.loyalty_points_total
  into v_current
  from public.profiles
  where profiles.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if p_source_type = 'staff_order'
    and p_source_id is not null
    and exists (
      select 1
      from public.loyalty_point_transactions
      where profile_id = p_profile_id
        and source_type = p_source_type
        and source_id = p_source_id
        and rule_id is not distinct from p_rule_id
    )
  then
    return query select p_profile_id, coalesce(v_current, 0);
    return;
  end if;

  v_next := greatest(0, coalesce(v_current, 0) + p_points_delta);

  update public.profiles
  set loyalty_points_total = v_next,
      updated_at = now()
  where id = p_profile_id;

  insert into public.loyalty_point_transactions (
    profile_id,
    rule_id,
    points_delta,
    balance_after,
    source_type,
    source_id,
    reason,
    created_by
  )
  values (
    p_profile_id,
    p_rule_id,
    p_points_delta,
    v_next,
    p_source_type,
    p_source_id,
    p_reason,
    p_created_by
  )
  on conflict do nothing;

  return query select p_profile_id, v_next;
end;
$$;

create or replace function public.set_profile_loyalty_points(
  p_profile_id uuid,
  p_points integer,
  p_reason text default null
)
returns table (
  profile_id uuid,
  loyalty_points_total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_delta integer;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_points is null or p_points < 0 then
    raise exception 'Loyalty points must be zero or higher.';
  end if;

  select profiles.loyalty_points_total
  into v_current
  from public.profiles
  where profiles.id = p_profile_id
    and profiles.deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  v_delta := p_points - coalesce(v_current, 0);

  return query
  select result.profile_id, result.loyalty_points_total
  from public.apply_loyalty_points_delta(
    p_profile_id,
    v_delta,
    null,
    'manual_adjustment',
    null,
    coalesce(nullif(btrim(p_reason), ''), 'Staff Console manual balance edit'),
    v_actor
  ) as result;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    'loyalty_points_total_edited',
    'profiles',
    p_profile_id,
    jsonb_build_object('loyalty_points_total', v_current),
    jsonb_build_object('loyalty_points_total', p_points)
  );
end;
$$;

create or replace function public.staff_order_loyalty_award_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_points integer;
begin
  if new.customer_id is null
    or new.session_id is null
    or new.payment_status <> 'paid'
    or new.order_status in ('cancelled', 'refunded', 'no_show')
    or (TG_OP = 'UPDATE' and old.payment_status = 'paid')
  then
    return new;
  end if;

  for v_rule in
    select *
    from public.staff_loyalty_rules
    where active = true
      and earn_trigger = 'session_payment_confirmed'
      and valid_from <= new.booking_date
      and (valid_until is null or valid_until >= new.booking_date)
      and (game_id is null or game_id = new.game_id)
      and coalesce(new.total, 0) >= min_order_total
  loop
    v_points := case v_rule.calculation_type
      when 'per_vnd_spent' then floor((coalesce(new.total, 0)::numeric / nullif(v_rule.spend_amount, 0)) * v_rule.points_value)::integer
      when 'per_player' then floor(greatest(coalesce(new.players_count, 0), 0)::numeric * v_rule.points_value)::integer
      else floor(v_rule.points_value)::integer
    end;

    if v_points > 0 then
      perform public.apply_loyalty_points_delta(
        new.customer_id,
        v_points,
        v_rule.id,
        'staff_order',
        new.id,
        'Session payment confirmed',
        null
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists staff_orders_loyalty_award on public.staff_orders;
create trigger staff_orders_loyalty_award
after insert or update of payment_status on public.staff_orders
for each row execute function public.staff_order_loyalty_award_trigger();

drop function if exists public.profile_search(text, integer, integer, text, boolean, text);

create or replace function public.profile_search(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_role text default null,
  p_include_demo boolean default false,
  p_sort text default 'name_asc'
)
returns table (
  id uuid,
  full_name text,
  nickname text,
  email text,
  phone text,
  role text,
  loyalty_points_total integer,
  is_seed_demo boolean,
  seed_batch text,
  total_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_sort text := coalesce(nullif(p_sort, ''), 'name_asc');
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  return query
  with filtered_profiles as (
    select
      p.id,
      p.full_name,
      p.nickname,
      p.email,
      p.phone,
      p.role,
      p.loyalty_points_total,
      coalesce(p.is_seed_demo, false) as is_seed_demo,
      p.seed_batch,
      coalesce(nullif(p.nickname, ''), nullif(p.full_name, ''), nullif(p.email, ''), nullif(p.phone, ''), 'Player') as sort_name,
      public.staff_role_rank(p.role, p.email) as role_rank
    from public.profiles p
    where p.deleted_at is null
      and (p_include_demo or not coalesce(p.is_seed_demo, false))
      and (
        v_role is null
        or v_role = 'all'
        or lower(coalesce(p.role, 'player')) = v_role
        or (v_role = 'owner' and public.staff_role_rank(p.role, p.email) >= 120)
        or (v_role = 'admin' and public.staff_role_rank(p.role, p.email) = 100)
      )
      and (
        v_search is null
        or lower(coalesce(p.full_name, '') || ' ' || coalesce(p.nickname, '') || ' ' || coalesce(p.email, '') || ' ' || coalesce(p.phone, '')) like '%' || v_search || '%'
      )
  ),
  counted_profiles as (
    select
      filtered_profiles.*,
      count(*) over ()::integer as total_count
    from filtered_profiles
  )
  select
    counted_profiles.id,
    counted_profiles.full_name,
    counted_profiles.nickname,
    counted_profiles.email,
    counted_profiles.phone,
    counted_profiles.role,
    counted_profiles.loyalty_points_total,
    counted_profiles.is_seed_demo,
    counted_profiles.seed_batch,
    counted_profiles.total_count
  from counted_profiles
  order by
    case when v_sort = 'role_desc' then counted_profiles.role_rank end desc nulls last,
    case when v_sort = 'role_asc' then counted_profiles.role_rank end asc nulls last,
    case when v_sort = 'name_desc' then lower(counted_profiles.sort_name) end desc nulls last,
    case when v_sort = 'email_asc' then lower(coalesce(counted_profiles.email, '')) end asc nulls last,
    lower(counted_profiles.sort_name) asc,
    lower(coalesce(counted_profiles.email, '')) asc,
    counted_profiles.id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.apply_loyalty_points_delta(uuid, integer, uuid, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.set_profile_loyalty_points(uuid, integer, text) from public, anon;
revoke all on function public.staff_order_loyalty_award_trigger() from public, anon, authenticated;
revoke all on function public.protect_profile_loyalty_points_total() from public, anon, authenticated;
revoke all on function public.profile_search(text, integer, integer, text, boolean, text) from public;

grant execute on function public.set_profile_loyalty_points(uuid, integer, text) to authenticated, service_role;
grant execute on function public.profile_search(text, integer, integer, text, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';
