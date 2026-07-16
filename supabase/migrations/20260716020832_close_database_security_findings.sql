begin;

-- Anonymous Auth users receive the authenticated Postgres role. Both private
-- join RPCs therefore need to reject the JWT is_anonymous claim inside their
-- SECURITY DEFINER bodies; grant changes alone cannot enforce this boundary.
do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_next_definition text;
  v_login_guard text := $guard$
  if v_actor is null then
    raise exception 'Login required.';
  end if;
$guard$;
  v_permanent_account_guard text := $guard$
  if v_actor is null
    or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
  then
    raise exception 'A permanent account is required.';
  end if;
$guard$;
begin
  foreach v_signature in array array[
    'public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature)
    into v_definition;

    if position('is_anonymous' in v_definition) = 0 then
      v_next_definition := replace(v_definition, v_login_guard, v_permanent_account_guard);

      if v_next_definition = v_definition then
        raise exception 'Could not install the permanent-account guard in %.', v_signature;
      end if;

      execute v_next_definition;
    end if;
  end loop;
end $$;

revoke all on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.join_private_session_with_code(uuid, text, text, text, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.join_private_session_waitlist_with_code(uuid, text, text, text, text, text, text, text, text)
  to authenticated, service_role;

-- Tournament audit entries are accepted only through a narrow RPC that derives
-- the actor from the JWT and reuses the tournament authorization boundary.
drop policy if exists "Authenticated can insert tournament audit log"
  on public.tournament_audit_log;

revoke insert on public.tournament_audit_log from anon, authenticated;

create or replace function public.log_tournament_audit(
  p_session_id uuid,
  p_action text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_action text := btrim(coalesce(p_action, ''));
begin
  if v_actor is null
    or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
    or not public.can_manage_tournament(p_session_id)
  then
    raise exception 'Not authorized to write this tournament audit entry.';
  end if;

  if char_length(v_action) not between 1 and 120 then
    raise exception 'Tournament audit action must be between 1 and 120 characters.';
  end if;

  if pg_column_size(coalesce(p_old_value, 'null'::jsonb)) > 32768
    or pg_column_size(coalesce(p_new_value, 'null'::jsonb)) > 32768
  then
    raise exception 'Tournament audit values are too large.';
  end if;

  insert into public.tournament_audit_log (
    session_id,
    user_id,
    action,
    old_value,
    new_value
  ) values (
    p_session_id,
    v_actor,
    v_action,
    p_old_value,
    p_new_value
  );
end;
$$;

revoke all on function public.log_tournament_audit(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_tournament_audit(uuid, text, jsonb, jsonb)
  to authenticated, service_role;

-- The browser no longer needs an exact phone-account lookup. Keep the helper
-- available only to trusted backend code so public callers cannot enumerate
-- which phone numbers belong to permanent accounts.
revoke all on function public.guest_ticket_phone_account_status(text)
  from public, anon, authenticated;
grant execute on function public.guest_ticket_phone_account_status(text)
  to service_role;

-- Fail the migration if a later statement or platform default reopens any of
-- the closed boundaries.
do $$
declare
  v_signature regprocedure;
begin
  if has_table_privilege('anon', 'public.tournament_audit_log', 'insert')
    or has_table_privilege('authenticated', 'public.tournament_audit_log', 'insert')
  then
    raise exception 'Direct tournament audit inserts are still exposed.';
  end if;

  if has_function_privilege('anon', 'public.log_tournament_audit(uuid,text,jsonb,jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.log_tournament_audit(uuid,text,jsonb,jsonb)', 'execute')
  then
    raise exception 'Tournament audit RPC grants are incorrect.';
  end if;

  if has_function_privilege('anon', 'public.guest_ticket_phone_account_status(text)', 'execute')
    or has_function_privilege('authenticated', 'public.guest_ticket_phone_account_status(text)', 'execute')
  then
    raise exception 'Phone account-status enumeration is still exposed.';
  end if;

  foreach v_signature in array array[
    'public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', v_signature, 'execute')
      or not has_function_privilege('authenticated', v_signature, 'execute')
      or position('is_anonymous' in pg_get_functiondef(v_signature)) = 0
    then
      raise exception 'Private-session authorization is not closed for %.', v_signature;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
