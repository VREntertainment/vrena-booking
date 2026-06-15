grant usage on schema public to authenticated, service_role;
grant delete on public.session_messages to authenticated;
grant select, insert, update, delete on public.session_messages to service_role;

drop policy if exists "admins delete session messages" on public.session_messages;

create policy "admins delete session messages"
on public.session_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (
        profiles.role = 'admin'
        or lower(profiles.email) = 'emile@vre-vietnam.com'
      )
  )
);
