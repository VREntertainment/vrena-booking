grant select, insert, update, delete on public.session_messages to authenticated;

drop policy if exists "participants create session messages" on public.session_messages;
drop policy if exists "authors delete own messages" on public.session_messages;
drop policy if exists "admins update session messages" on public.session_messages;
drop policy if exists "admins delete session messages" on public.session_messages;

create policy "participants create session messages"
on public.session_messages
for insert
with check (
  auth.uid() = author_id
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
    )
    or exists (
      select 1 from public.session_participants
      where session_participants.session_id = session_messages.session_id
        and session_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.sessions
      where sessions.id = session_messages.session_id
        and sessions.owner_id = auth.uid()
    )
  )
);

create policy "authors delete own messages"
on public.session_messages
for delete
using (auth.uid() = author_id);

create policy "admins update session messages"
on public.session_messages
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
  )
);

create policy "admins delete session messages"
on public.session_messages
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.role = 'admin' or lower(profiles.email) = 'emile@vre-vietnam.com')
  )
);
