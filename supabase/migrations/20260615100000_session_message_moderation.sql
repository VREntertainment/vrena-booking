alter table public.session_messages
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending_review', 'rejected')),
  add column if not exists moderation_reason text,
  add column if not exists moderation_categories jsonb not null default '{}'::jsonb,
  add column if not exists moderation_score numeric,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists session_messages_session_status_idx
on public.session_messages (session_id, moderation_status, created_at);

grant select on public.session_messages to anon;
revoke insert on public.session_messages from authenticated;
grant select, update, delete on public.session_messages to authenticated;

drop policy if exists "session messages are readable" on public.session_messages;
drop policy if exists "participants create session messages" on public.session_messages;
drop policy if exists "admins update session messages" on public.session_messages;
drop policy if exists "session creators and admins review messages" on public.session_messages;

create policy "session messages are readable"
on public.session_messages
for select
using (
  moderation_status = 'approved'
  or author_id = (select auth.uid())
  or exists (
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

create policy "session creators and admins review messages"
on public.session_messages
for update
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
