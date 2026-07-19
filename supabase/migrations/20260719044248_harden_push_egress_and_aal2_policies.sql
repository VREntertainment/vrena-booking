begin;

-- Browser-created subscriptions must point at a recognized Web Push service.
-- The Edge Function repeats this allowlist at the network sink so already
-- stored or privileged rows cannot turn the worker into arbitrary HTTPS egress.
drop policy if exists "users create own push subscriptions"
  on public.push_subscriptions;
drop policy if exists "users update own push subscriptions"
  on public.push_subscriptions;

create policy "users create own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  (select auth.uid()) = profile_id
  and (
    lower(endpoint) ~ '^https://fcm[.]googleapis[.]com/'
    or lower(endpoint) ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'
    or lower(endpoint) ~ '^https://web[.]push[.]apple[.]com/'
    or lower(endpoint) ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'
  )
);

create policy "users update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check (
  (select auth.uid()) = profile_id
  and (
    lower(endpoint) ~ '^https://fcm[.]googleapis[.]com/'
    or lower(endpoint) ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'
    or lower(endpoint) ~ '^https://web[.]push[.]apple[.]com/'
    or lower(endpoint) ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'
  )
);

-- Preserve the public, author, and session-owner message paths. Staff access
-- is separated into authenticated-only policies that use the shared AAL2-aware
-- rank helper instead of trusting profile role/email fields directly.
drop policy if exists "session messages are readable"
  on public.session_messages;
drop policy if exists "aal2 admins read session messages"
  on public.session_messages;
drop policy if exists "session creators and admins review messages"
  on public.session_messages;
drop policy if exists "admins delete session messages"
  on public.session_messages;

create policy "session messages are readable"
on public.session_messages
for select
to public
using (
  moderation_status = 'approved'
  or author_id = (select auth.uid())
  or exists (
    select 1
    from public.sessions
    where sessions.id = session_messages.session_id
      and sessions.owner_id = (select auth.uid())
  )
);

create policy "aal2 admins read session messages"
on public.session_messages
for select
to authenticated
using (coalesce((select public.current_staff_role_rank()), 0) >= 100);

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
  or coalesce((select public.current_staff_role_rank()), 0) >= 100
)
with check (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_messages.session_id
      and sessions.owner_id = (select auth.uid())
  )
  or coalesce((select public.current_staff_role_rank()), 0) >= 100
);

create policy "admins delete session messages"
on public.session_messages
for delete
to authenticated
using (coalesce((select public.current_staff_role_rank()), 0) >= 100);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'users create own push subscriptions'
      and cmd = 'INSERT'
      and position('fcm' in coalesce(with_check, '')) > 0
      and position('mozilla' in coalesce(with_check, '')) > 0
      and position('apple' in coalesce(with_check, '')) > 0
      and position('windows' in coalesce(with_check, '')) > 0
  ) or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'users update own push subscriptions'
      and cmd = 'UPDATE'
      and position('fcm' in coalesce(with_check, '')) > 0
      and position('mozilla' in coalesce(with_check, '')) > 0
      and position('apple' in coalesce(with_check, '')) > 0
      and position('windows' in coalesce(with_check, '')) > 0
  ) then
    raise exception 'Push subscription provider restrictions were not installed.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_messages'
      and (
        coalesce(qual, '') ~* '(profiles[.]role|lower[(]profiles[.]email|emile@vre-vietnam[.]com)'
        or coalesce(with_check, '') ~* '(profiles[.]role|lower[(]profiles[.]email|emile@vre-vietnam[.]com)'
      )
  ) then
    raise exception 'A legacy session-message staff predicate still bypasses AAL2.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_messages'
      and policyname = 'aal2 admins read session messages'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
      and position('current_staff_role_rank' in coalesce(qual, '')) > 0
  ) or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_messages'
      and policyname = 'session creators and admins review messages'
      and cmd = 'UPDATE'
      and position('current_staff_role_rank' in coalesce(qual, '')) > 0
      and position('current_staff_role_rank' in coalesce(with_check, '')) > 0
  ) or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_messages'
      and policyname = 'admins delete session messages'
      and cmd = 'DELETE'
      and position('current_staff_role_rank' in coalesce(qual, '')) > 0
  ) then
    raise exception 'AAL2-aware session-message policies were not installed.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
