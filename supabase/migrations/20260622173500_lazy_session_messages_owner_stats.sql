begin;

create index if not exists session_messages_session_created_active_idx
on public.session_messages (session_id, created_at desc)
where deleted_at is null;

grant update (score, accuracy_percent, projectiles_fired, placement, escape_duration_seconds)
on public.session_participants
to authenticated;

grant update (score_adjustment)
on public.profiles
to authenticated;

drop policy if exists "admins update participant results" on public.session_participants;
drop policy if exists "session managers update participant results" on public.session_participants;

create policy "session managers update participant results"
on public.session_participants
for update
to authenticated
using (
  public.current_staff_role_rank() >= 100
  or exists (
    select 1
    from public.sessions
    where sessions.id = session_participants.session_id
      and sessions.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.tournament_editors
    where tournament_editors.session_id = session_participants.session_id
      and tournament_editors.profile_id = (select auth.uid())
  )
)
with check (
  public.current_staff_role_rank() >= 100
  or exists (
    select 1
    from public.sessions
    where sessions.id = session_participants.session_id
      and sessions.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.tournament_editors
    where tournament_editors.session_id = session_participants.session_id
      and tournament_editors.profile_id = (select auth.uid())
  )
);

drop policy if exists "admins update profile score adjustment" on public.profiles;

create policy "admins update profile score adjustment"
on public.profiles
for update
to authenticated
using (public.current_staff_role_rank() >= 100)
with check (public.current_staff_role_rank() >= 100);

notify pgrst, 'reload schema';

commit;
