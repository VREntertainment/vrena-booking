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
  created_at timestamptz,
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
      p.created_at,
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
    counted_profiles.created_at,
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
    case when v_sort = 'created_desc' then counted_profiles.created_at end desc nulls last,
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

revoke all on function public.profile_search(text, integer, integer, text, boolean, text) from public;
grant execute on function public.profile_search(text, integer, integer, text, boolean, text) to authenticated, service_role;
