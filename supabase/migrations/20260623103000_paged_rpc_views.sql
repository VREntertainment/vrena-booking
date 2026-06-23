begin;

create table if not exists public.session_waitlist (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

alter table public.session_waitlist
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists avatar_emoji text,
  add column if not exists avatar_initials text,
  add column if not exists avatar_color text,
  add column if not exists avatar_text_color text,
  add column if not exists profile_motto text,
  add column if not exists created_at timestamptz not null default now();

alter table public.session_waitlist enable row level security;

grant select on public.session_waitlist to anon;
grant select, insert, delete on public.session_waitlist to authenticated;

drop policy if exists "waitlist rows are readable" on public.session_waitlist;
create policy "waitlist rows are readable"
on public.session_waitlist
for select
using (true);

drop policy if exists "users can join their own waitlist" on public.session_waitlist;
create policy "users can join their own waitlist"
on public.session_waitlist
for insert
with check (auth.uid() = profile_id);

drop policy if exists "users can leave their own waitlist" on public.session_waitlist;
create policy "users can leave their own waitlist"
on public.session_waitlist
for delete
using (auth.uid() = profile_id);

drop policy if exists "session owners can manage waitlist" on public.session_waitlist;
create policy "session owners can manage waitlist"
on public.session_waitlist
for delete
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_waitlist.session_id
      and sessions.owner_id = auth.uid()
  )
);

drop policy if exists "admins can manage waitlist" on public.session_waitlist;
create policy "admins can manage waitlist"
on public.session_waitlist
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and public.staff_role_rank(profiles.role, profiles.email) >= 100
  )
);

create or replace function public.promote_session_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_waitlist public.session_waitlist%rowtype;
  v_participant_count integer;
begin
  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null
    and status <> 'cancelled'
  for update;

  if not found then
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.session_participants
  where session_id = p_session_id
    and deleted_at is null;

  if v_participant_count >= v_session.max_players then
    return;
  end if;

  select *
  into v_waitlist
  from public.session_waitlist
  where session_id = p_session_id
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.session_participants
    where session_id = p_session_id
      and profile_id = v_waitlist.profile_id
      and deleted_at is null
  ) then
    insert into public.session_participants (
      session_id,
      profile_id,
      display_name,
      avatar_url,
      avatar_emoji,
      avatar_initials,
      avatar_color,
      avatar_text_color,
      profile_motto
    ) values (
      v_waitlist.session_id,
      v_waitlist.profile_id,
      v_waitlist.display_name,
      v_waitlist.avatar_url,
      v_waitlist.avatar_emoji,
      v_waitlist.avatar_initials,
      v_waitlist.avatar_color,
      v_waitlist.avatar_text_color,
      v_waitlist.profile_motto
    );
  end if;

  delete from public.session_waitlist where id = v_waitlist.id;
end;
$$;

grant execute on function public.promote_session_waitlist(uuid) to authenticated;

create index if not exists sessions_list_page_active_idx
on public.sessions (date, start_time, id)
where deleted_at is null and status <> 'cancelled';

create index if not exists session_participants_session_active_idx
on public.session_participants (session_id, profile_id)
where deleted_at is null;

create index if not exists session_waitlist_session_created_idx
on public.session_waitlist (session_id, created_at);

create index if not exists profiles_active_search_idx
on public.profiles (
  lower(coalesce(nickname, full_name, phone, email, '')),
  id
)
where deleted_at is null;

create index if not exists staff_orders_page_idx
on public.staff_orders (booking_date desc, booking_time desc, created_at desc);

create or replace function public.sessions_list_page(
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 120,
  p_offset integer default 0,
  p_include_blocked_times boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sessions jsonb := '[]'::jsonb;
  v_score_adjustments jsonb := '{}'::jsonb;
  v_blocked_times jsonb := '[]'::jsonb;
  v_has_more_after boolean := false;
begin
  with selected_sessions as (
    select s.*
    from public.sessions s
    where s.deleted_at is null
      and s.status <> 'cancelled'
      and (p_start_date is null or s.date >= p_start_date)
      and (p_end_date is null or s.date <= p_end_date)
    order by s.date asc, s.start_time asc, s.id asc
    limit v_limit
    offset v_offset
  ),
  participant_rows as (
    select
      sp.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'profile_id', sp.profile_id,
          'display_name', sp.display_name,
          'avatar_url', sp.avatar_url,
          'avatar_emoji', sp.avatar_emoji,
          'avatar_initials', sp.avatar_initials,
          'avatar_color', sp.avatar_color,
          'avatar_text_color', sp.avatar_text_color,
          'profile_motto', sp.profile_motto,
          'checked_in', sp.checked_in
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
    group by sp.session_id
  ),
  waitlist_rows as (
    select
      sw.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sw.id,
          'session_id', sw.session_id,
          'profile_id', sw.profile_id,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_sessions s on s.id = sw.session_id
    group by sw.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_sessions s on s.id = sp.session_id
    where sp.deleted_at is null
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'owner_id', s.owner_id,
        'club_id', s.club_id,
        'session_type', s.session_type,
        'name', s.name,
        'date', s.date,
        'start_time', s.start_time,
        'duration_minutes', s.duration_minutes,
        'max_players', s.max_players,
        'arena_count', s.arena_count,
        'game_options', s.game_options,
        'confirmed_game_id', s.confirmed_game_id,
        'visibility', s.visibility,
        'invite_code', s.invite_code,
        'status', s.status,
        'rounds_per_match', s.rounds_per_match,
        'seeded', s.seeded,
        'seed_label', s.seed_label,
        'booking_type', s.booking_type,
        'ticket_type', s.ticket_type,
        'ticket_player_count', s.ticket_player_count,
        'challenge_target_id', s.challenge_target_id,
        'challenge_status', s.challenge_status,
        'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
        'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
      )
      order by s.date asc, s.start_time asc, s.id asc
    ), '[]'::jsonb),
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  into v_sessions, v_score_adjustments
  from selected_sessions s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id;

  if p_end_date is not null then
    select exists (
      select 1
      from public.sessions s
      where s.deleted_at is null
        and s.status <> 'cancelled'
        and s.date > p_end_date
    )
    into v_has_more_after;
  end if;

  if p_include_blocked_times then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', bt.date,
        'start_time', bt.start_time,
        'end_time', bt.end_time,
        'arenas_used', bt.arenas_used
      )
      order by bt.date asc, bt.start_time asc
    ), '[]'::jsonb)
    into v_blocked_times
    from public.blocked_times bt
    where (p_start_date is null or bt.date >= p_start_date)
      and (p_end_date is null or bt.date <= p_end_date);
  end if;

  return jsonb_build_object(
    'sessions', coalesce(v_sessions, '[]'::jsonb),
    'scoreAdjustments', coalesce(v_score_adjustments, '{}'::jsonb),
    'blockedTimes', coalesce(v_blocked_times, '[]'::jsonb),
    'hasMoreAfter', coalesce(v_has_more_after, false),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.session_detail(p_session_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  with selected_session as (
    select s.*
    from public.sessions s
    where s.id = p_session_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
    limit 1
  ),
  participant_rows as (
    select
      sp.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'profile_id', sp.profile_id,
          'display_name', sp.display_name,
          'avatar_url', sp.avatar_url,
          'avatar_emoji', sp.avatar_emoji,
          'avatar_initials', sp.avatar_initials,
          'avatar_color', sp.avatar_color,
          'avatar_text_color', sp.avatar_text_color,
          'profile_motto', sp.profile_motto,
          'checked_in', sp.checked_in,
          'payment_status', sp.payment_status,
          'payment_amount', sp.payment_amount,
          'payment_splits', sp.payment_splits,
          'score', sp.score,
          'accuracy_percent', sp.accuracy_percent,
          'projectiles_fired', sp.projectiles_fired,
          'escape_duration_seconds', sp.escape_duration_seconds,
          'placement', sp.placement,
          'prize_claimed', sp.prize_claimed,
          'prize_claimed_at', sp.prize_claimed_at
        )
        order by sp.id
      ) as session_participants
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
    group by sp.session_id
  ),
  waitlist_rows as (
    select
      sw.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sw.id,
          'session_id', sw.session_id,
          'profile_id', sw.profile_id,
          'display_name', sw.display_name,
          'avatar_url', sw.avatar_url,
          'avatar_emoji', sw.avatar_emoji,
          'avatar_initials', sw.avatar_initials,
          'avatar_color', sw.avatar_color,
          'avatar_text_color', sw.avatar_text_color,
          'profile_motto', sw.profile_motto,
          'created_at', sw.created_at
        )
        order by sw.created_at asc, sw.id
      ) as session_waitlist
    from public.session_waitlist sw
    join selected_session s on s.id = sw.session_id
    group by sw.session_id
  ),
  invite_rows as (
    select
      si.session_id,
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'session_id', si.session_id,
          'inviter_id', si.inviter_id,
          'recipient_id', si.recipient_id,
          'recipient_display_name', si.recipient_display_name,
          'recipient_avatar_url', si.recipient_avatar_url,
          'recipient_avatar_emoji', si.recipient_avatar_emoji,
          'recipient_avatar_initials', si.recipient_avatar_initials,
          'recipient_avatar_color', si.recipient_avatar_color,
          'recipient_avatar_text_color', si.recipient_avatar_text_color,
          'recipient_profile_motto', si.recipient_profile_motto,
          'status', si.status,
          'created_at', si.created_at
        )
        order by si.created_at desc, si.id
      ) as session_invites
    from public.session_invites si
    join selected_session s on s.id = si.session_id
    where (select auth.uid()) is not null
    group by si.session_id
  ),
  participant_profile_ids as (
    select distinct sp.profile_id
    from public.session_participants sp
    join selected_session s on s.id = sp.session_id
    where sp.deleted_at is null
  )
  select jsonb_build_object(
    'session',
    jsonb_build_object(
      'id', s.id,
      'owner_id', s.owner_id,
      'club_id', s.club_id,
      'session_type', s.session_type,
      'name', s.name,
      'date', s.date,
      'start_time', s.start_time,
      'duration_minutes', s.duration_minutes,
      'max_players', s.max_players,
      'arena_count', s.arena_count,
      'game_options', s.game_options,
      'game_votes', s.game_votes,
      'confirmed_game_id', s.confirmed_game_id,
      'visibility', s.visibility,
      'invite_code', s.invite_code,
      'notes', s.notes,
      'status', s.status,
      'tournament_format', s.tournament_format,
      'best_of', s.best_of,
      'rounds_per_match', s.rounds_per_match,
      'require_payment', s.require_payment,
      'qualification_rule', s.qualification_rule,
      'custom_qualifiers', s.custom_qualifiers,
      'enable_third_place_match', s.enable_third_place_match,
      'first_prize', s.first_prize,
      'second_prize', s.second_prize,
      'third_prize', s.third_prize,
      'tournament_locked', s.tournament_locked,
      'seeded', s.seeded,
      'seed_label', s.seed_label,
      'seed_batch', s.seed_batch,
      'booking_type', s.booking_type,
      'ticket_type', s.ticket_type,
      'ticket_player_count', s.ticket_player_count,
      'ticket_total_price', s.ticket_total_price,
      'ticket_unit_price', s.ticket_unit_price,
      'ticket_status', s.ticket_status,
      'ticket_reference', s.ticket_reference,
      'ticket_customer_id', s.ticket_customer_id,
      'challenge_target_id', s.challenge_target_id,
      'challenge_status', s.challenge_status,
      'challenge_accepted_at', s.challenge_accepted_at,
      'challenge_declined_at', s.challenge_declined_at,
      'session_participants', coalesce(pr.session_participants, '[]'::jsonb),
      'session_waitlist', coalesce(wr.session_waitlist, '[]'::jsonb)
    ),
    'invites',
    coalesce(ir.session_invites, '[]'::jsonb),
    'scoreAdjustments',
    coalesce((
      select jsonb_object_agg(p.id::text, coalesce(p.score_adjustment, 0))
      from public.profiles p
      join participant_profile_ids ids on ids.profile_id = p.id
      where p.deleted_at is null
    ), '{}'::jsonb)
  )
  into v_payload
  from selected_session s
  left join participant_rows pr on pr.session_id = s.id
  left join waitlist_rows wr on wr.session_id = s.id
  left join invite_rows ir on ir.session_id = s.id;

  return coalesce(v_payload, jsonb_build_object(
    'session', null,
    'invites', '[]'::jsonb,
    'scoreAdjustments', '{}'::jsonb
  ));
end;
$$;

create or replace function public.staff_report_summary(
  p_start_date date,
  p_end_date date,
  p_compare_start date default null,
  p_compare_end date default null,
  p_order_limit integer default 120
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_staff_daily_report(
    p_start_date,
    p_end_date,
    p_compare_start,
    p_compare_end,
    p_order_limit
  );
$$;

create or replace function public.staff_orders_page(
  p_start_date date,
  p_end_date date,
  p_limit integer default 120,
  p_offset integer default 0,
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start date := least(p_start_date, p_end_date);
  v_end date := greatest(p_start_date, p_end_date);
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_orders jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_total_count integer := 0;
begin
  if not public.is_staff_console_user(20) then
    raise exception 'Staff Console access required';
  end if;

  with filtered_orders as (
    select o.*
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
  )
  select count(*)::integer
  into v_total_count
  from filtered_orders;

  with filtered_orders as (
    select o.*
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
    order by o.booking_date desc, o.booking_time desc, o.created_at desc
    limit v_limit
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(fo) order by fo.booking_date desc, fo.booking_time desc, fo.created_at desc), '[]'::jsonb)
  into v_orders
  from filtered_orders fo;

  with selected_order_ids as (
    select o.id
    from public.staff_orders o
    where o.booking_date between v_start and v_end
      and (v_status is null or o.order_status = v_status)
      and (
        v_search is null
        or lower(coalesce(o.order_number, '') || ' ' || coalesce(o.customer_name, '') || ' ' || coalesce(o.customer_phone, '') || ' ' || coalesce(o.customer_email, '')) like '%' || v_search || '%'
      )
    order by o.booking_date desc, o.booking_time desc, o.created_at desc
    limit v_limit
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at asc, p.id asc), '[]'::jsonb)
  into v_payments
  from public.staff_order_payments p
  where p.order_id in (select id from selected_order_ids);

  return jsonb_build_object(
    'orders', coalesce(v_orders, '[]'::jsonb),
    'payments', coalesce(v_payments, '[]'::jsonb),
    'totalCount', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

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

revoke all on function public.sessions_list_page(date, date, integer, integer, boolean) from public;
revoke all on function public.session_detail(uuid) from public;
revoke all on function public.staff_report_summary(date, date, date, date, integer) from public;
revoke all on function public.staff_orders_page(date, date, integer, integer, text, text) from public;
revoke all on function public.profile_search(text, integer, integer, text, boolean, text) from public;

grant execute on function public.sessions_list_page(date, date, integer, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.session_detail(uuid) to anon, authenticated, service_role;
grant execute on function public.staff_report_summary(date, date, date, date, integer) to authenticated, service_role;
grant execute on function public.staff_orders_page(date, date, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.profile_search(text, integer, integer, text, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
