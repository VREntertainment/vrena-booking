begin;

create or replace function public.can_read_club_member_row(
  p_club_id uuid,
  p_member_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vrena_admin()
    or p_member_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and (
          c.visibility = 'public'
          or c.owner_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.profile_id = (select auth.uid())
        and cm.status = 'approved'
        and cm.deleted_at is null
    );
$$;

create or replace function public.can_insert_club_member_row(
  p_club_id uuid,
  p_member_profile_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_member_profile_id = (select auth.uid())
    and exists (
      select 1
      from public.clubs c
      where c.id = p_club_id
        and (
          (c.owner_id = (select auth.uid()) and p_status = 'approved')
          or (c.visibility = 'public' and p_status = 'approved')
          or (c.visibility = 'private' and p_status = 'pending')
        )
    );
$$;

revoke all on function public.can_read_club_member_row(uuid, uuid) from public;
revoke all on function public.can_insert_club_member_row(uuid, uuid, text) from public;
grant execute on function public.can_read_club_member_row(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_insert_club_member_row(uuid, uuid, text) to authenticated, service_role;

grant insert on public.club_members to authenticated;

drop policy if exists "club members readable by allowed users" on public.club_members;
drop policy if exists "users insert own club membership rows" on public.club_members;

create policy "club members readable by allowed users"
on public.club_members
for select
to authenticated
using (
  public.can_read_club_member_row(club_id, profile_id)
);

create policy "users insert own club membership rows"
on public.club_members
for insert
to authenticated
with check (
  deleted_at is null
  and public.can_insert_club_member_row(club_id, profile_id, status)
);

commit;
