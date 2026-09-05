begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- A raised exception rolls back rate-limit writes in the same RPC transaction.
-- Keep the attempt outside the protected operation's exception subtransaction.
-- PostgREST's response.status returns the same HTTP 400/error.message contract
-- to current clients while committing the counter and rolling back failed work.
-- The two void RPCs have no database dependants; their successful clients ignore
-- the response body. JSON null keeps that behavior and permits error JSON.
drop function public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text);
drop function public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text);

create function public.join_private_session_with_code(
  p_session_id uuid, p_invite_code text, p_display_name text,
  p_avatar_url text default null, p_avatar_emoji text default null,
  p_avatar_initials text default null, p_avatar_color text default null,
  p_avatar_text_color text default null, p_profile_motto text default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required.';
  end if;
  if char_length(coalesce(p_invite_code, '')) > 64 then
    raise exception 'Incorrect private session code.';
  end if;
  perform public.consume_rate_limit('booking_attempt', 20, 600, 'private-code:actor-global');
  perform public.consume_rate_limit('booking_attempt', 5, 600,
    'private-code:session:' || coalesce(p_session_id::text, 'missing'));
  begin
    perform private.join_private_session_with_code(
      p_session_id, p_invite_code, p_display_name, p_avatar_url,
      p_avatar_emoji, p_avatar_initials, p_avatar_color,
      p_avatar_text_color, p_profile_motto);
  exception when raise_exception then
    perform set_config('response.status', '400', true);
    return jsonb_build_object('code', SQLSTATE, 'message', SQLERRM, 'details', null, 'hint', null);
  end;
  return null;
end;
$$;

create function public.join_private_session_waitlist_with_code(
  p_session_id uuid, p_invite_code text, p_display_name text,
  p_avatar_url text default null, p_avatar_emoji text default null,
  p_avatar_initials text default null, p_avatar_color text default null,
  p_avatar_text_color text default null, p_profile_motto text default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required.';
  end if;
  if char_length(coalesce(p_invite_code, '')) > 64 then
    raise exception 'Incorrect private session code.';
  end if;
  perform public.consume_rate_limit('booking_attempt', 20, 600, 'private-code:actor-global');
  perform public.consume_rate_limit('booking_attempt', 5, 600,
    'private-code:session:' || coalesce(p_session_id::text, 'missing'));
  begin
    perform private.join_private_session_waitlist_with_code(
      p_session_id, p_invite_code, p_display_name, p_avatar_url,
      p_avatar_emoji, p_avatar_initials, p_avatar_color,
      p_avatar_text_color, p_profile_motto);
  exception when raise_exception then
    perform set_config('response.status', '400', true);
    return jsonb_build_object('code', SQLSTATE, 'message', SQLERRM, 'details', null, 'hint', null);
  end;
  return null;
end;
$$;

create or replace function public.claim_guest_ticket_booking(p_guest_phone text, p_ticket_reference text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_guest_phone text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required.';
  end if;
  if char_length(coalesce(p_guest_phone, '')) > 64
    or char_length(coalesce(p_ticket_reference, '')) > 64 then
    raise exception 'Invalid booking claim.';
  end if;
  -- Match the private claim's canonical phone exactly: changing punctuation
  -- must not create a new allowance for the same phone/reference combination.
  v_guest_phone := regexp_replace(public.normalize_guest_ticket_phone(p_guest_phone), '(?!^)\+', '', 'g');
  perform public.consume_rate_limit('booking_attempt', 10, 600, 'guest-claim:actor-global');
  perform public.consume_rate_limit('booking_attempt', 3, 600,
    'guest-claim:' || coalesce(v_guest_phone, '') || ':'
      || upper(btrim(coalesce(p_ticket_reference, ''))));
  begin
    return private.claim_guest_ticket_booking(p_guest_phone, p_ticket_reference);
  exception when raise_exception then
    perform set_config('response.status', '400', true);
    return jsonb_build_object('code', SQLSTATE, 'message', SQLERRM, 'details', null, 'hint', null);
  end;
end;
$$;

revoke all on function public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text),
  public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text),
  public.claim_guest_ticket_booking(text,text) from public, anon, authenticated;
grant execute on function public.join_private_session_with_code(uuid,text,text,text,text,text,text,text,text),
  public.join_private_session_waitlist_with_code(uuid,text,text,text,text,text,text,text,text),
  public.claim_guest_ticket_booking(text,text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
