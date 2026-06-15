alter table public.profiles
add column if not exists score_adjustment integer not null default 0;

grant select (score_adjustment) on public.profiles to authenticated;
grant update (score_adjustment) on public.profiles to authenticated;
grant select, update on public.profiles to service_role;

grant update (score, accuracy_percent, projectiles_fired, placement) on public.session_participants to authenticated;
grant update on public.session_participants to service_role;

create or replace function public.is_vrena_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (
        profiles.role = 'admin'
        or lower(profiles.email) = 'emile@vre-vietnam.com'
      )
  );
$$;

revoke all on function public.is_vrena_admin() from public;
grant execute on function public.is_vrena_admin() to authenticated, service_role;

drop policy if exists "admins update profile score adjustment" on public.profiles;
drop policy if exists "admins update participant results" on public.session_participants;

create policy "admins update profile score adjustment"
on public.profiles
for update
to authenticated
using (public.is_vrena_admin())
with check (public.is_vrena_admin());

create policy "admins update participant results"
on public.session_participants
for update
to authenticated
using (public.is_vrena_admin())
with check (public.is_vrena_admin());
