begin;

alter table public.clubs
  add column if not exists member_count integer not null default 0 check (member_count >= 0);

update public.clubs c
set member_count = coalesce(member_counts.approved_count, 0)
from (
  select
    club_id,
    count(*)::integer as approved_count
  from public.club_members
  where status = 'approved'
    and deleted_at is null
  group by club_id
) as member_counts
where member_counts.club_id = c.id;

update public.clubs c
set member_count = 0
where not exists (
  select 1
  from public.club_members cm
  where cm.club_id = c.id
    and cm.status = 'approved'
    and cm.deleted_at is null
);

drop trigger if exists club_members_refresh_member_count on public.club_members;
drop function if exists public.refresh_club_member_count_trigger() cascade;
drop function if exists public.refresh_club_member_count(uuid) cascade;

create or replace function public.refresh_club_member_count(target_club_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clubs
  set member_count = coalesce((
    select count(*)::integer
    from public.club_members
    where club_members.club_id = target_club_id
      and club_members.status = 'approved'
      and club_members.deleted_at is null
  ), 0)
  where clubs.id = target_club_id;
$$;

create or replace function public.refresh_club_member_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_club_member_count(old.club_id);
    return old;
  end if;

  perform public.refresh_club_member_count(new.club_id);

  if tg_op = 'UPDATE' and old.club_id is distinct from new.club_id then
    perform public.refresh_club_member_count(old.club_id);
  end if;

  return new;
end;
$$;

create trigger club_members_refresh_member_count
after insert or update of club_id, status, deleted_at or delete on public.club_members
for each row execute function public.refresh_club_member_count_trigger();

revoke all on function public.refresh_club_member_count(uuid) from public, anon, authenticated;
revoke all on function public.refresh_club_member_count_trigger() from public, anon, authenticated;

create or replace function public.clubs_list_page()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  motto text,
  description text,
  banner_url text,
  theme_color text,
  default_language text,
  ranking_criterion text,
  visibility text,
  pin_code text,
  member_count integer,
  created_at timestamptz,
  club_members jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with listable_clubs as (
    select
      c.id,
      c.owner_id,
      c.name::text as name,
      c.motto::text as motto,
      c.description::text as description,
      c.banner_url::text as banner_url,
      c.theme_color::text as theme_color,
      c.default_language::text as default_language,
      c.ranking_criterion::text as ranking_criterion,
      c.visibility::text as visibility,
      c.pin_code::text as pin_code,
      c.member_count::integer as member_count,
      c.created_at,
      (
        public.is_vrena_admin()
        or c.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.club_members manager_membership
          where manager_membership.club_id = c.id
            and manager_membership.profile_id = (select auth.uid())
            and manager_membership.status = 'approved'
            and manager_membership.role in ('admin', 'moderator')
            and manager_membership.deleted_at is null
        )
      ) as can_manage_members,
      (
        c.visibility = 'public'
        or public.is_vrena_admin()
        or c.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.club_members own_approved_membership
          where own_approved_membership.club_id = c.id
            and own_approved_membership.profile_id = (select auth.uid())
            and own_approved_membership.status = 'approved'
            and own_approved_membership.deleted_at is null
        )
      ) as can_view_members
    from public.clubs c
  )
  select
    listable_clubs.id,
    listable_clubs.owner_id,
    listable_clubs.name,
    listable_clubs.motto,
    listable_clubs.description,
    listable_clubs.banner_url,
    listable_clubs.theme_color,
    listable_clubs.default_language,
    listable_clubs.ranking_criterion,
    listable_clubs.visibility,
    listable_clubs.pin_code,
    listable_clubs.member_count,
    listable_clubs.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'club_id', cm.club_id,
          'profile_id', cm.profile_id,
          'display_name', cm.display_name,
          'avatar_url', cm.avatar_url,
          'avatar_emoji', cm.avatar_emoji,
          'avatar_initials', cm.avatar_initials,
          'avatar_color', cm.avatar_color,
          'avatar_text_color', cm.avatar_text_color,
          'profile_motto', cm.profile_motto,
          'status', cm.status,
          'deleted_at', cm.deleted_at,
          'role', cm.role,
          'created_at', cm.created_at
        )
        order by
          case when cm.status = 'approved' then 0 else 1 end,
          cm.created_at nulls last,
          cm.display_name nulls last
      )
      from public.club_members cm
      where cm.club_id = listable_clubs.id
        and cm.deleted_at is null
        and (
          (cm.status = 'approved' and listable_clubs.can_view_members)
          or cm.profile_id = (select auth.uid())
          or listable_clubs.can_manage_members
        )
    ), '[]'::jsonb) as club_members
  from listable_clubs
  order by listable_clubs.created_at desc nulls last, listable_clubs.name asc;
$$;

revoke all on function public.clubs_list_page() from public, anon;
grant execute on function public.clubs_list_page() to authenticated, service_role;

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
    return;
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
    d.valid_from desc,
    d.name asc
  limit 1;
end;
$$;

revoke all on function public.ticket_automatic_discount_quote(date, integer, integer, text, integer, time, text) from public;
grant execute on function public.ticket_automatic_discount_quote(date, integer, integer, text, integer, time, text) to anon, authenticated, service_role;

grant execute on function public.can_manage_session_row(uuid) to authenticated, service_role;
grant execute on function public.can_view_session_row(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
