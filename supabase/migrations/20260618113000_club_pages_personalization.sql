alter table public.clubs
  add column if not exists motto text,
  add column if not exists banner_url text,
  add column if not exists theme_color text not null default '#3059ff',
  add column if not exists default_language text,
  add column if not exists ranking_criterion text not null default 'totalScore',
  add column if not exists updated_at timestamptz not null default now();

alter table public.club_members
  add column if not exists role text not null default 'member',
  add column if not exists created_at timestamptz not null default now();

update public.club_members
set role = 'member'
where role is null
   or role not in ('admin', 'moderator', 'member');

update public.clubs
set ranking_criterion = 'totalScore'
where ranking_criterion is null
   or ranking_criterion not in ('totalScore', 'wins', 'winRate', 'accuracy', 'reliability', 'projectiles', 'gamesPlayed');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clubs_ranking_criterion_check'
      and conrelid = 'public.clubs'::regclass
  ) then
    alter table public.clubs
      add constraint clubs_ranking_criterion_check
      check (ranking_criterion in ('totalScore', 'wins', 'winRate', 'accuracy', 'reliability', 'projectiles', 'gamesPlayed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_members_role_check'
      and conrelid = 'public.club_members'::regclass
  ) then
    alter table public.club_members
      add constraint club_members_role_check
      check (role in ('admin', 'moderator', 'member'));
  end if;
end $$;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        lower(coalesce(profiles.role, '')) = 'admin'
        or lower(coalesce(profiles.email, '')) in ('emile@vre-vietnam.com', 'contact@vre-vietnam.com')
      )
  );
$$;

create or replace function public.club_member_role(p_club_id uuid, p_profile_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = p_profile_id
    ) then 'owner'
    else coalesce((
      select club_members.role
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = p_profile_id
        and club_members.status = 'approved'
      limit 1
    ), '')
  end;
$$;

create or replace function public.can_view_club_private_content(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and (
          clubs.visibility = 'public'
          or clubs.owner_id = auth.uid()
        )
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
    );
$$;

create or replace function public.can_manage_club_settings(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
        and club_members.role = 'admin'
    );
$$;

create or replace function public.can_manage_club_member(
  p_club_id uuid,
  p_target_profile_id uuid,
  p_target_role text default 'member'
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with actor as (
    select public.club_member_role(p_club_id, auth.uid()) as role
  ),
  target as (
    select case
      when exists (
        select 1
        from public.clubs
        where clubs.id = p_club_id
          and clubs.owner_id = p_target_profile_id
      ) then 'owner'
      else coalesce(nullif(p_target_role, ''), 'member')
    end as role
  )
  select public.is_vrena_admin()
    or exists (
      select 1
      from actor, target
      where actor.role = 'owner'
        and target.role <> 'owner'
    )
    or exists (
      select 1
      from actor, target
      where actor.role = 'admin'
        and target.role in ('moderator', 'member')
    )
    or exists (
      select 1
      from actor, target
      where actor.role = 'moderator'
        and target.role = 'member'
    );
$$;

create or replace function public.can_manage_club_banner_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select case
    when split_part(p_object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_manage_club_settings(split_part(p_object_name, '/', 1)::uuid)
    else false
  end;
$$;

create or replace function public.transfer_club_ownership(p_club_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_owner_id uuid;
begin
  select owner_id
  into v_previous_owner_id
  from public.clubs
  where id = p_club_id
  for update;

  if v_previous_owner_id is null then
    raise exception 'Club not found';
  end if;

  if not (public.is_vrena_admin() or v_previous_owner_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.club_members
    where club_id = p_club_id
      and profile_id = p_new_owner_id
      and status = 'approved'
  ) then
    raise exception 'New owner must be an approved member';
  end if;

  update public.clubs
  set owner_id = p_new_owner_id,
      updated_at = now()
  where id = p_club_id;

  update public.club_members
  set status = 'approved',
      role = 'admin'
  where club_id = p_club_id
    and profile_id in (v_previous_owner_id, p_new_owner_id);
end;
$$;

grant execute on function public.is_vrena_admin() to anon, authenticated;
grant execute on function public.club_member_role(uuid, uuid) to anon, authenticated;
grant execute on function public.can_view_club_private_content(uuid) to anon, authenticated;
grant execute on function public.can_manage_club_settings(uuid) to authenticated;
grant execute on function public.can_manage_club_member(uuid, uuid, text) to authenticated;
grant execute on function public.can_manage_club_banner_path(text) to authenticated;
grant execute on function public.transfer_club_ownership(uuid, uuid) to authenticated;

grant select on public.clubs to anon, authenticated;
grant update (
  name,
  description,
  visibility,
  pin_code,
  motto,
  banner_url,
  theme_color,
  default_language,
  ranking_criterion,
  updated_at
) on public.clubs to authenticated;

grant select on public.club_members to anon, authenticated;
grant update (status, role) on public.club_members to authenticated;
grant delete on public.club_members to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'clubs'
      and policyname = 'club settings editable by authorized club roles'
  ) then
    create policy "club settings editable by authorized club roles"
    on public.clubs
    for update
    using (public.can_manage_club_settings(id))
    with check (public.can_manage_club_settings(id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'club_members'
      and policyname = 'club members view private content by role'
  ) then
    create policy "club members view private content by role"
    on public.club_members
    for select
    using (public.can_view_club_private_content(club_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'club_members'
      and policyname = 'club member roles managed by authorized roles'
  ) then
    create policy "club member roles managed by authorized roles"
    on public.club_members
    for update
    using (public.can_manage_club_member(club_id, profile_id, role))
    with check (public.can_manage_club_member(club_id, profile_id, role));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'club_members'
      and policyname = 'club members removed by authorized roles'
  ) then
    create policy "club members removed by authorized roles"
    on public.club_members
    for delete
    using (public.can_manage_club_member(club_id, profile_id, role));
  end if;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'club-banners',
      'club-banners',
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
      and policyname = 'club banners are public'
  ) then
    create policy "club banners are public"
    on storage.objects
    for select
    using (bucket_id = 'club-banners');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'club banner uploads by club managers'
  ) then
    create policy "club banner uploads by club managers"
    on storage.objects
    for insert
    with check (
      bucket_id = 'club-banners'
      and public.can_manage_club_banner_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'club banner updates by club managers'
  ) then
    create policy "club banner updates by club managers"
    on storage.objects
    for update
    using (
      bucket_id = 'club-banners'
      and public.can_manage_club_banner_path(name)
    )
    with check (
      bucket_id = 'club-banners'
      and public.can_manage_club_banner_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'club banner deletes by club managers'
  ) then
    create policy "club banner deletes by club managers"
    on storage.objects
    for delete
    using (
      bucket_id = 'club-banners'
      and public.can_manage_club_banner_path(name)
    );
  end if;
end $$;
