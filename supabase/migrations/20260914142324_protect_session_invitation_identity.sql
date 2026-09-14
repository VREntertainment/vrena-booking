-- An invitation authorizes exactly one recipient for exactly one session.
-- RLS checks the recipient, but cannot compare the old and new session IDs.
-- Keep the authorization binding immutable while allowing accept/decline and
-- profile snapshot refreshes. A different invitation must be created explicitly.
begin;

create or replace function private.protect_session_invitation_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.session_id is distinct from old.session_id
    or new.inviter_id is distinct from old.inviter_id
    or new.recipient_id is distinct from old.recipient_id
  then
    raise exception using
      errcode = '42501',
      message = 'An invitation cannot be reassigned to another session or user.';
  end if;
  return new;
end;
$function$;

revoke all on function private.protect_session_invitation_identity() from public, anon, authenticated;

create or replace trigger session_invites_protect_identity
before update on public.session_invites
for each row execute function private.protect_session_invitation_identity();

commit;
