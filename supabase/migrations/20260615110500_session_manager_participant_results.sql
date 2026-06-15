grant update (score, accuracy_percent, projectiles_fired, placement) on public.session_participants to authenticated;
grant update on public.session_participants to service_role;

drop policy if exists "session managers update participant results" on public.session_participants;

create policy "session managers update participant results"
on public.session_participants
for update
to authenticated
using (
  public.is_vrena_admin()
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
  public.is_vrena_admin()
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
