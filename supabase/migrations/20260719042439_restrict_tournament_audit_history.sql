begin;

drop policy if exists "Public can read tournament audit log"
  on public.tournament_audit_log;
drop policy if exists "Tournament managers read audit history"
  on public.tournament_audit_log;

revoke all privileges on table public.tournament_audit_log
  from public, anon, authenticated;
grant select on table public.tournament_audit_log
  to authenticated, service_role;

create policy "Tournament managers read audit history"
on public.tournament_audit_log
for select
to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and public.can_manage_tournament(session_id)
);

do $$
begin
  if has_table_privilege('anon', 'public.tournament_audit_log', 'select')
    or has_table_privilege('anon', 'public.tournament_audit_log', 'insert')
    or has_table_privilege('anon', 'public.tournament_audit_log', 'update')
    or has_table_privilege('anon', 'public.tournament_audit_log', 'delete')
    or has_table_privilege('anon', 'public.tournament_audit_log', 'truncate')
  then
    raise exception 'Anonymous tournament audit table access is still exposed.';
  end if;

  if not has_table_privilege('authenticated', 'public.tournament_audit_log', 'select')
    or has_table_privilege('authenticated', 'public.tournament_audit_log', 'insert')
    or has_table_privilege('authenticated', 'public.tournament_audit_log', 'update')
    or has_table_privilege('authenticated', 'public.tournament_audit_log', 'delete')
    or has_table_privilege('authenticated', 'public.tournament_audit_log', 'truncate')
  then
    raise exception 'Authenticated tournament audit grants are incorrect.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tournament_audit_log'
      and policyname = 'Tournament managers read audit history'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
      and position('can_manage_tournament' in qual) > 0
      and position('is_anonymous' in qual) > 0
  ) then
    raise exception 'Tournament audit manager policy was not installed correctly.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
