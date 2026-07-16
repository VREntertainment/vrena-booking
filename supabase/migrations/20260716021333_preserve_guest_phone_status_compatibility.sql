begin;

-- Preserve compatibility with already-deployed clients without disclosing
-- whether the supplied phone belongs to an account. New clients no longer call
-- this RPC, but older tabs can continue into the guest booking flow safely.
create or replace function public.guest_ticket_phone_account_status(p_guest_phone text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_guest_phone text := regexp_replace(coalesce(p_guest_phone, ''), '[^0-9+]', '', 'g');
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null
    or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15
  then
    raise exception 'Enter a valid phone number.';
  end if;

  return jsonb_build_object(
    'normalized_phone', v_guest_phone,
    'has_account', false
  );
end;
$$;

revoke all on function public.guest_ticket_phone_account_status(text)
  from public, anon, authenticated;
grant execute on function public.guest_ticket_phone_account_status(text)
  to anon, authenticated, service_role;

do $$
declare
  v_definition text := pg_get_functiondef(
    'public.guest_ticket_phone_account_status(text)'::regprocedure
  );
begin
  if not has_function_privilege('anon', 'public.guest_ticket_phone_account_status(text)', 'execute')
    or not has_function_privilege('authenticated', 'public.guest_ticket_phone_account_status(text)', 'execute')
    or exists (
      select 1
      from pg_proc procedures
      where procedures.oid = 'public.guest_ticket_phone_account_status(text)'::regprocedure
        and procedures.prosecdef
    )
    or position('profile_has_account' in v_definition) > 0
    or position('from public.profiles' in lower(v_definition)) > 0
    or position('from auth.users' in lower(v_definition)) > 0
  then
    raise exception 'The compatibility phone-status RPC still exposes account data.';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
