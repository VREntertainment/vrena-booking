begin;

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
            and manager_membership.role = 'admin'
            and manager_membership.deleted_at is null
        )
      ) as can_view_pin_code,
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
        (select auth.uid()) is not null
        and (
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
    case when listable_clubs.can_view_pin_code then listable_clubs.pin_code else null end as pin_code,
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

revoke all on function public.clubs_list_page() from public;
grant execute on function public.clubs_list_page() to anon, authenticated, service_role;

commit;
