create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists role text;

create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
as $$
  select case
    when lower(coalesce(p_email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com') then 100
    when lower(coalesce(p_role, '')) in ('owner', 'admin') then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) in ('staff', 'cashier') then 50
    when lower(coalesce(p_role, '')) = 'viewer' then 20
    else 0
  end;
$$;

create or replace function public.current_staff_role_rank()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(max(public.staff_role_rank(role, email)), 0)
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function public.is_staff_console_user(p_min_rank integer default 20)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= p_min_rank;
$$;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_staff_role_rank() >= 100;
$$;

revoke all on function public.staff_role_rank(text, text) from public;
revoke all on function public.current_staff_role_rank() from public;
revoke all on function public.is_staff_console_user(integer) from public;
revoke all on function public.is_vrena_admin() from public;
grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.is_staff_console_user(integer) to authenticated, service_role;
grant execute on function public.is_vrena_admin() to authenticated, service_role;

create or replace function public.can_manage_staff_game_image_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_staff_console_user(80)
    and coalesce(p_object_name, '') <> '';
$$;

revoke all on function public.can_manage_staff_game_image_path(text) from public;
grant execute on function public.can_manage_staff_game_image_path(text) to authenticated, service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'staff-game-images',
      'staff-game-images',
      true,
      2097152,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game images are public'
  ) then
    create policy "staff game images are public"
    on storage.objects
    for select
    using (bucket_id = 'staff-game-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image uploads by managers'
  ) then
    create policy "staff game image uploads by managers"
    on storage.objects
    for insert
    with check (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image updates by managers'
  ) then
    create policy "staff game image updates by managers"
    on storage.objects
    for update
    using (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    )
    with check (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image deletes by managers'
  ) then
    create policy "staff game image deletes by managers"
    on storage.objects
    for delete
    using (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;
end $$;

create table if not exists public.staff_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  game_type text not null default 'other'
    check (game_type in ('shooting', 'escape', 'tournament', 'other')),
  duration_minutes integer not null default 20 check (duration_minutes > 0 and duration_minutes <= 240),
  max_players_per_arena integer not null default 4 check (max_players_per_arena > 0 and max_players_per_arena <= 32),
  number_of_rounds integer not null default 1 check (number_of_rounds > 0 and number_of_rounds <= 20),
  description text,
  difficulty text,
  image_url text,
  active boolean not null default true,
  available_arena_ids text[] not null default array['arena-1']::text[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  game_id uuid references public.staff_games(id) on delete set null,
  day_type text not null default 'weekday'
    check (day_type in ('weekday', 'weekend', 'holiday', 'custom')),
  time_start time,
  time_end time,
  price_per_player integer not null default 0 check (price_per_player >= 0),
  price_per_arena_slot integer check (price_per_arena_slot is null or price_per_arena_slot >= 0),
  valid_from date not null default current_date,
  valid_until date,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  check (time_start is null or time_end is null or time_start < time_end)
);

create table if not exists public.staff_discount_rules (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  discount_type text not null
    check (discount_type in ('percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group')),
  value numeric(10, 2) not null default 0 check (value >= 0),
  valid_from date not null default current_date,
  valid_until date,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);

create unique index if not exists staff_discount_rules_code_unique_idx
on public.staff_discount_rules (lower(code))
where code is not null and btrim(code) <> '';

create table if not exists public.staff_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  game_id uuid references public.staff_games(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  booking_date date not null,
  booking_time time not null,
  players_count integer not null check (players_count > 0 and players_count <= 64),
  arena_id text,
  subtotal integer not null default 0 check (subtotal >= 0),
  discount_rule_id uuid references public.staff_discount_rules(id) on delete set null,
  discount_code text,
  discount_total integer not null default 0 check (discount_total >= 0),
  total integer not null default 0 check (total >= 0),
  payment_method text not null default 'unpaid'
    check (payment_method in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partially_paid', 'paid', 'refunded')),
  order_status text not null default 'confirmed'
    check (order_status in ('draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoice_required boolean not null default false,
  company_name text,
  tax_code text,
  invoice_email text,
  invoice_address text,
  invoice_status text not null default 'not_requested'
    check (invoice_status in ('not_requested', 'pending', 'issued', 'cancelled')),
  external_invoice_id text,
  internal_note text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create sequence if not exists public.staff_order_number_seq;

create index if not exists staff_games_active_idx on public.staff_games (active, name);
create index if not exists staff_pricing_rules_lookup_idx on public.staff_pricing_rules (active, game_id, day_type, valid_from, valid_until);
create index if not exists staff_pricing_rules_time_idx on public.staff_pricing_rules (time_start, time_end) where active = true;
create index if not exists staff_discount_rules_active_idx on public.staff_discount_rules (active, valid_from, valid_until);
create index if not exists staff_orders_booking_date_idx on public.staff_orders (booking_date, booking_time);
create index if not exists staff_orders_status_idx on public.staff_orders (order_status, payment_status, booking_date);
create index if not exists staff_orders_customer_idx on public.staff_orders (customer_id) where customer_id is not null;
create index if not exists staff_orders_session_idx on public.staff_orders (session_id) where session_id is not null;
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

create or replace function public.staff_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.staff_set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := 'VR-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.staff_order_number_seq'::regclass)::text, 5, '0');
  end if;
  return new;
end;
$$;

create or replace function public.staff_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  if TG_TABLE_NAME = 'staff_games' then
    if TG_OP = 'INSERT' then
      v_action := 'game_created';
    elsif old.active = true and new.active = false then
      v_action := 'game_deactivated';
    else
      v_action := 'game_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_pricing_rules' then
    if TG_OP = 'INSERT' then
      v_action := 'price_created';
    elsif old.active = true and new.active = false then
      v_action := 'price_deactivated';
    else
      v_action := 'price_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_discount_rules' then
    if TG_OP = 'INSERT' then
      v_action := 'discount_created';
    elsif old.active = true and new.active = false then
      v_action := 'discount_deactivated';
    else
      v_action := 'discount_edited';
    end if;
  elsif TG_TABLE_NAME = 'staff_orders' then
    if TG_OP = 'INSERT' then
      v_action := 'order_created';
    elsif old.payment_status is distinct from new.payment_status then
      v_action := 'payment_status_changed';
    elsif old.order_status is distinct from new.order_status and new.order_status = 'cancelled' then
      v_action := 'order_cancelled';
    elsif old.order_status is distinct from new.order_status and new.order_status = 'refunded' then
      v_action := 'order_refunded';
    elsif old.discount_total is distinct from new.discount_total or old.discount_rule_id is distinct from new.discount_rule_id then
      v_action := 'discount_applied';
    else
      v_action := 'order_edited';
    end if;
  else
    v_action := lower(TG_OP);
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    v_action,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then old.id else new.id end,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists staff_games_set_updated_at on public.staff_games;
create trigger staff_games_set_updated_at before update on public.staff_games
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_pricing_rules_set_updated_at on public.staff_pricing_rules;
create trigger staff_pricing_rules_set_updated_at before update on public.staff_pricing_rules
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_discount_rules_set_updated_at on public.staff_discount_rules;
create trigger staff_discount_rules_set_updated_at before update on public.staff_discount_rules
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_orders_set_updated_at on public.staff_orders;
create trigger staff_orders_set_updated_at before update on public.staff_orders
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_orders_set_order_number on public.staff_orders;
create trigger staff_orders_set_order_number before insert on public.staff_orders
for each row execute function public.staff_set_order_number();

drop trigger if exists staff_games_audit on public.staff_games;
create trigger staff_games_audit after insert or update on public.staff_games
for each row execute function public.staff_audit_trigger();

drop trigger if exists staff_pricing_rules_audit on public.staff_pricing_rules;
create trigger staff_pricing_rules_audit after insert or update on public.staff_pricing_rules
for each row execute function public.staff_audit_trigger();

drop trigger if exists staff_discount_rules_audit on public.staff_discount_rules;
create trigger staff_discount_rules_audit after insert or update on public.staff_discount_rules
for each row execute function public.staff_audit_trigger();

drop trigger if exists staff_orders_audit on public.staff_orders;
create trigger staff_orders_audit after insert or update on public.staff_orders
for each row execute function public.staff_audit_trigger();

alter table public.staff_games enable row level security;
alter table public.staff_pricing_rules enable row level security;
alter table public.staff_discount_rules enable row level security;
alter table public.staff_orders enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update on public.staff_games to authenticated;
grant select, insert, update on public.staff_pricing_rules to authenticated;
grant select, insert, update on public.staff_discount_rules to authenticated;
grant select, insert, update on public.staff_orders to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on sequence public.staff_order_number_seq to authenticated;

drop policy if exists "staff games select" on public.staff_games;
drop policy if exists "staff games insert" on public.staff_games;
drop policy if exists "staff games update" on public.staff_games;
create policy "staff games select" on public.staff_games for select to authenticated using (public.is_staff_console_user(20));
create policy "staff games insert" on public.staff_games for insert to authenticated with check (public.is_staff_console_user(80));
create policy "staff games update" on public.staff_games for update to authenticated using (public.is_staff_console_user(80)) with check (public.is_staff_console_user(80));

drop policy if exists "staff prices select" on public.staff_pricing_rules;
drop policy if exists "staff prices insert" on public.staff_pricing_rules;
drop policy if exists "staff prices update" on public.staff_pricing_rules;
create policy "staff prices select" on public.staff_pricing_rules for select to authenticated using (public.is_staff_console_user(20));
create policy "staff prices insert" on public.staff_pricing_rules for insert to authenticated with check (public.is_staff_console_user(80));
create policy "staff prices update" on public.staff_pricing_rules for update to authenticated using (public.is_staff_console_user(80)) with check (public.is_staff_console_user(80));

drop policy if exists "staff discounts select" on public.staff_discount_rules;
drop policy if exists "staff discounts insert" on public.staff_discount_rules;
drop policy if exists "staff discounts update" on public.staff_discount_rules;
create policy "staff discounts select" on public.staff_discount_rules for select to authenticated using (public.is_staff_console_user(20));
create policy "staff discounts insert" on public.staff_discount_rules for insert to authenticated with check (public.is_staff_console_user(50));
create policy "staff discounts update" on public.staff_discount_rules for update to authenticated using (public.is_staff_console_user(50)) with check (public.is_staff_console_user(50));

drop policy if exists "staff orders select" on public.staff_orders;
drop policy if exists "staff orders insert" on public.staff_orders;
drop policy if exists "staff orders update" on public.staff_orders;
create policy "staff orders select" on public.staff_orders for select to authenticated using (public.is_staff_console_user(20));
create policy "staff orders insert" on public.staff_orders for insert to authenticated with check (public.is_staff_console_user(50));
create policy "staff orders update" on public.staff_orders for update to authenticated using (public.is_staff_console_user(50)) with check (public.is_staff_console_user(50));

drop policy if exists "staff audit select" on public.audit_logs;
drop policy if exists "staff audit insert" on public.audit_logs;
create policy "staff audit select" on public.audit_logs for select to authenticated using (public.is_staff_console_user(20));
create policy "staff audit insert" on public.audit_logs for insert to authenticated with check (public.is_staff_console_user(50));

insert into public.staff_games (slug, name, game_type, duration_minutes, max_players_per_arena, number_of_rounds, description, difficulty, image_url, available_arena_ids)
values
  ('laser-tag', 'Laser Tag', 'shooting', 20, 4, 1, 'Fast team shooting round.', 'medium', '/games/laser-tag.png', array['arena-1', 'arena-2']),
  ('mini-block-towers', 'Mini Block Towers', 'shooting', 20, 4, 1, 'Block battle shooting game.', 'easy', '/games/mini-block-towers.png', array['arena-1', 'arena-2']),
  ('office-war', 'Office War', 'shooting', 20, 4, 1, 'Office-themed team battle.', 'easy', '/games/office-war.png', array['arena-1', 'arena-2']),
  ('paintball', 'Paintball', 'shooting', 20, 4, 1, 'VR paintball match.', 'medium', '/games/paintball.png', array['arena-1', 'arena-2']),
  ('snow-battle', 'Snow Battle', 'shooting', 20, 4, 1, 'Snowball arena battle.', 'easy', '/games/snow-battle.png', array['arena-1', 'arena-2']),
  ('castle-unspunnen', 'Castle Unspunnen', 'shooting', 20, 4, 1, 'Castle arena shooting game.', 'medium', '/games/castle-unspunnen.png', array['arena-1', 'arena-2']),
  ('wild-west', 'Wild West', 'shooting', 20, 4, 1, 'Western arena duel.', 'medium', '/games/wild-west.png', array['arena-1', 'arena-2']),
  ('arc-of-the-covenant', 'The Secret of the Arc', 'escape', 40, 4, 1, 'Escape game mission.', 'hard', '/games/arc-of-the-covenant.png', array['arena-1']),
  ('joller-house', 'Joller House', 'escape', 40, 4, 1, 'Escape game mystery.', 'hard', '/games/joller-house.png', array['arena-2'])
on conflict (slug) do nothing;

insert into public.staff_pricing_rules (rule_name, day_type, time_start, time_end, price_per_player, valid_from, active)
select *
from (
  values
    ('Weekday day standard', 'weekday', '09:00'::time, '18:00'::time, 200000, current_date, true),
    ('Weekday evening standard', 'weekday', '18:00'::time, '22:00'::time, 250000, current_date, true),
    ('Weekend standard', 'weekend', '09:00'::time, '22:00'::time, 330000, current_date, true)
) as seed(rule_name, day_type, time_start, time_end, price_per_player, valid_from, active)
where not exists (
  select 1
  from public.staff_pricing_rules existing
  where lower(existing.rule_name) = lower(seed.rule_name)
);

create or replace function public.create_staff_order(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_game_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_players_count integer,
  p_arena_id text,
  p_discount_rule_id uuid,
  p_payment_method text,
  p_payment_status text,
  p_order_status text,
  p_invoice_required boolean default false,
  p_company_name text default null,
  p_tax_code text default null,
  p_invoice_email text default null,
  p_invoice_address text default null,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := (select auth.uid());
  v_game public.staff_games%rowtype;
  v_rule public.staff_pricing_rules%rowtype;
  v_discount public.staff_discount_rules%rowtype;
  v_customer public.profiles%rowtype;
  v_booking_minutes integer;
  v_end_minutes integer;
  v_duration_blocks integer;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_total integer := 0;
  v_discount_code text := null;
  v_session_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_game_slug text;
  v_invite_code text;
  v_active_session_arenas integer;
  v_blocked_arenas integer;
  v_remaining_arenas integer;
  v_display_name text;
begin
  if v_staff_id is null or not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_game_id is null or p_booking_date is null or p_booking_time is null then
    raise exception 'Game, date, and time are required.';
  end if;

  if p_players_count is null or p_players_count < 1 or p_players_count > 64 then
    raise exception 'Invalid player count.';
  end if;

  if p_payment_method not in ('cash', 'bank_transfer', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid') then
    raise exception 'Invalid payment method.';
  end if;

  if p_payment_status not in ('unpaid', 'partially_paid', 'paid', 'refunded') then
    raise exception 'Invalid payment status.';
  end if;

  if p_order_status not in ('draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed') then
    raise exception 'Invalid order status.';
  end if;

  select *
  into v_game
  from public.staff_games
  where id = p_game_id
    and active = true;

  if not found then
    raise exception 'Active game not found.';
  end if;

  select *
  into v_rule
  from public.staff_pricing_rules
  where active = true
    and (game_id is null or game_id = p_game_id)
    and valid_from <= p_booking_date
    and (valid_until is null or valid_until >= p_booking_date)
    and (
      day_type = 'custom'
      or (day_type = 'holiday' and p_booking_date between valid_from and coalesce(valid_until, valid_from))
      or (day_type = 'weekend' and extract(isodow from p_booking_date) in (6, 7))
      or (day_type = 'weekday' and extract(isodow from p_booking_date) between 1 and 5)
    )
    and (time_start is null or p_booking_time >= time_start)
    and (time_end is null or p_booking_time < time_end)
  order by
    case when game_id = p_game_id then 0 else 1 end,
    case when day_type in ('custom', 'holiday') then 0 else 1 end,
    valid_from desc,
    created_at desc
  limit 1;

  if not found then
    v_rule.price_per_player := 200000;
    v_rule.price_per_arena_slot := null;
  end if;

  v_booking_minutes := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_minutes := v_booking_minutes + v_game.duration_minutes;
  v_duration_blocks := greatest(1, ceil(v_game.duration_minutes::numeric / 20)::integer);

  if v_booking_minutes < 9 * 60 or v_end_minutes > 22 * 60 then
    raise exception 'Selected time is outside opening hours.';
  end if;

  with overlapping_sessions as (
    select coalesce(arena_count, case when max_players > 7 then 2 else 1 end) as arenas_used
    from public.sessions
    where date = p_booking_date
      and status = 'open'
      and (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
      ) < v_end_minutes
      and v_booking_minutes < (
        extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer + duration_minutes
      )
    for update
  )
  select coalesce(sum(arenas_used), 0)
  into v_active_session_arenas
  from overlapping_sessions;

  select coalesce(sum(arenas_used), 0)
  into v_blocked_arenas
  from public.blocked_times
  where date = p_booking_date
    and (
      extract(hour from start_time::time)::integer * 60 + extract(minute from start_time::time)::integer
    ) < v_end_minutes
    and v_booking_minutes < (
      extract(hour from end_time::time)::integer * 60 + extract(minute from end_time::time)::integer
    );

  v_remaining_arenas := 2 - coalesce(v_active_session_arenas, 0) - coalesce(v_blocked_arenas, 0);

  if v_remaining_arenas < 1 then
    raise exception 'Selected time slot is no longer available.';
  end if;

  if v_rule.price_per_arena_slot is not null then
    v_subtotal := v_duration_blocks * v_rule.price_per_arena_slot;
  else
    v_subtotal := greatest(0, coalesce(v_rule.price_per_player, 0)) * p_players_count;
  end if;

  if p_discount_rule_id is not null then
    select *
    into v_discount
    from public.staff_discount_rules
    where id = p_discount_rule_id
      and active = true
      and valid_from <= p_booking_date
      and (valid_until is null or valid_until >= p_booking_date)
    for update;

    if not found then
      raise exception 'Discount is not active.';
    end if;

    if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
      raise exception 'Discount use limit reached.';
    end if;

    v_discount_code := v_discount.code;
    if v_discount.discount_type in ('percentage', 'birthday', 'resident', 'group') then
      v_discount_total := round(v_subtotal * least(v_discount.value, 100) / 100)::integer;
    elsif v_discount.discount_type = 'fixed_amount' then
      v_discount_total := v_discount.value::integer;
    elsif v_discount.discount_type = 'free_ticket' then
      v_discount_total := greatest(coalesce(v_rule.price_per_player, 0), 0);
    end if;

    v_discount_total := least(v_subtotal, greatest(0, v_discount_total));

    update public.staff_discount_rules
    set used_count = used_count + 1
    where id = v_discount.id;
  end if;

  v_total := greatest(0, v_subtotal - v_discount_total);
  v_game_slug := coalesce(nullif(v_game.slug, ''), replace(lower(v_game.name), ' ', '-'));
  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sessions (
    owner_id,
    club_id,
    session_type,
    name,
    date,
    start_time,
    duration_minutes,
    max_players,
    arena_count,
    game_options,
    game_votes,
    confirmed_game_id,
    visibility,
    invite_code,
    notes,
    status,
    tournament_format,
    best_of,
    rounds_per_match,
    require_payment,
    qualification_rule,
    custom_qualifiers,
    enable_third_place_match,
    first_prize,
    second_prize,
    third_prize,
    tournament_locked,
    booking_type,
    ticket_type,
    ticket_player_count,
    ticket_unit_price,
    ticket_total_price,
    ticket_status,
    ticket_reference,
    ticket_customer_id
  ) values (
    v_staff_id,
    null,
    'game',
    'Staff booking - ' || v_game.name,
    p_booking_date,
    p_booking_time,
    v_game.duration_minutes,
    p_players_count,
    1,
    array[v_game_slug],
    jsonb_build_object(v_staff_id::text, v_game_slug),
    v_game_slug,
    'private',
    v_invite_code,
    nullif(concat_ws(' · ', 'Staff Console', p_internal_note), ''),
    'open',
    null,
    1,
    null,
    false,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    'ticket',
    'individual',
    p_players_count,
    coalesce(v_rule.price_per_player, 0),
    v_total,
    case when p_order_status in ('cancelled', 'refunded') then 'cancelled' else 'confirmed' end,
    'POS-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    p_customer_id
  )
  returning id into v_session_id;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.profiles
    where id = p_customer_id;

    if found then
      v_display_name := coalesce(v_customer.nickname, v_customer.full_name, v_customer.phone, v_customer.email, 'Customer');
      insert into public.session_participants (
        session_id,
        profile_id,
        display_name,
        avatar_url,
        avatar_emoji,
        avatar_initials,
        avatar_color,
        avatar_text_color,
        profile_motto,
        payment_amount
      ) values (
        v_session_id,
        p_customer_id,
        v_display_name,
        v_customer.avatar_url,
        v_customer.avatar_emoji,
        v_customer.avatar_initials,
        v_customer.avatar_color,
        v_customer.avatar_text_color,
        v_customer.profile_motto,
        v_total
      )
      on conflict do nothing;
    end if;
  end if;

  insert into public.staff_orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    game_id,
    session_id,
    booking_date,
    booking_time,
    players_count,
    arena_id,
    subtotal,
    discount_rule_id,
    discount_code,
    discount_total,
    total,
    payment_method,
    payment_status,
    order_status,
    created_by,
    invoice_required,
    company_name,
    tax_code,
    invoice_email,
    invoice_address,
    invoice_status,
    internal_note
  ) values (
    p_customer_id,
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_phone), ''),
    nullif(btrim(p_customer_email), ''),
    p_game_id,
    v_session_id,
    p_booking_date,
    p_booking_time,
    p_players_count,
    nullif(btrim(p_arena_id), ''),
    v_subtotal,
    p_discount_rule_id,
    v_discount_code,
    v_discount_total,
    v_total,
    p_payment_method,
    p_payment_status,
    p_order_status,
    v_staff_id,
    coalesce(p_invoice_required, false),
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_tax_code), ''),
    nullif(btrim(p_invoice_email), ''),
    nullif(btrim(p_invoice_address), ''),
    case when coalesce(p_invoice_required, false) then 'pending' else 'not_requested' end,
    nullif(btrim(p_internal_note), '')
  )
  returning id, order_number into v_order_id, v_order_number;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'session_id', v_session_id,
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_total
  );
end;
$$;

revoke all on function public.create_staff_order(uuid, text, text, text, uuid, date, time, integer, text, uuid, text, text, text, boolean, text, text, text, text, text) from public, anon;
grant execute on function public.create_staff_order(uuid, text, text, text, uuid, date, time, integer, text, uuid, text, text, text, boolean, text, text, text, text, text) to authenticated, service_role;
