begin;

create or replace function public.promote_session_waitlist_internal(p_session_id uuid)
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
    and status <> 'cancelled'
    and deleted_at is null
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

revoke all on function public.promote_session_waitlist_internal(uuid) from public, anon, authenticated;
grant execute on function public.promote_session_waitlist_internal(uuid) to service_role;

create or replace function public.promote_waitlist_after_participant_departure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.promote_session_waitlist_internal(old.session_id);

  if tg_op = 'UPDATE' then
    return new;
  end if;

  return old;
end;
$$;

revoke all on function public.promote_waitlist_after_participant_departure() from public, anon, authenticated;

drop trigger if exists session_participants_promote_waitlist_after_soft_delete on public.session_participants;
create trigger session_participants_promote_waitlist_after_soft_delete
after update of deleted_at on public.session_participants
for each row
when (old.deleted_at is null and new.deleted_at is not null)
execute function public.promote_waitlist_after_participant_departure();

drop trigger if exists session_participants_promote_waitlist_after_delete on public.session_participants;
create trigger session_participants_promote_waitlist_after_delete
after delete on public.session_participants
for each row
execute function public.promote_waitlist_after_participant_departure();

create or replace function public.promote_session_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    perform public.promote_session_waitlist_internal(p_session_id);
    return;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Login required.';
  end if;

  if not public.can_manage_session_row(p_session_id) then
    raise exception 'Session manager access required.';
  end if;

  perform public.promote_session_waitlist_internal(p_session_id);
end;
$$;

revoke all on function public.promote_session_waitlist(uuid) from public, anon, authenticated;
grant execute on function public.promote_session_waitlist(uuid) to authenticated, service_role;

commit;
