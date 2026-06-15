grant usage on schema public to anon, authenticated, service_role;

grant select on public.session_messages to anon, authenticated;
grant select, insert, update, delete on public.session_messages to service_role;
grant update (moderation_status, reviewed_by, reviewed_at) on public.session_messages to authenticated;
grant delete on public.session_messages to authenticated;

drop policy if exists "session creators and admins review messages" on public.session_messages;

create policy "session creators and admins review messages"
on public.session_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_messages.session_id
      and sessions.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
  )
)
with check (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_messages.session_id
      and sessions.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
  )
);
