create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
as $$
  select case
    when lower(coalesce(p_email, '')) in ('emile@vre-vietnam.com', 'emilejacquet@icloud.com') then 120
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_email, '')) = 'contact@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) in ('staff', 'cashier') then 50
    when lower(coalesce(p_role, '')) = 'viewer' then 20
    else 0
  end;
$$;

update public.profiles
set role = 'owner',
    updated_at = now()
where lower(coalesce(email, '')) = 'emilejacquet@icloud.com'
  and deleted_at is null;

do $$
begin
  if to_regclass('public.session_waitlist') is not null then
    execute 'drop policy if exists "admins can manage waitlist" on public.session_waitlist';
    execute $policy$
      create policy "admins can manage waitlist"
      on public.session_waitlist
      for delete
      using (public.is_vrena_admin())
    $policy$;
  end if;

  if to_regclass('public.session_messages') is not null then
    execute 'drop policy if exists "session messages are readable" on public.session_messages';
    execute $policy$
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
        or public.is_vrena_admin()
      )
    $policy$;

    execute 'drop policy if exists "participants create session messages" on public.session_messages';
    execute $policy$
      create policy "participants create session messages"
      on public.session_messages
      for insert
      with check (
        auth.uid() = author_id
        and (
          public.is_vrena_admin()
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
      )
    $policy$;

    execute 'drop policy if exists "session creators and admins review messages" on public.session_messages';
    execute $policy$
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
        or public.is_vrena_admin()
      )
      with check (
        exists (
          select 1
          from public.sessions
          where sessions.id = session_messages.session_id
            and sessions.owner_id = (select auth.uid())
        )
        or public.is_vrena_admin()
      )
    $policy$;

    execute 'drop policy if exists "admins delete session messages" on public.session_messages';
    execute $policy$
      create policy "admins delete session messages"
      on public.session_messages
      for delete
      to authenticated
      using (public.is_vrena_admin())
    $policy$;
  end if;
end $$;

revoke all on function public.staff_role_rank(text, text) from public;
grant execute on function public.staff_role_rank(text, text) to authenticated, service_role;
