begin;

-- Every console role must have a verified factor and an AAL2 JWT. Keeping this
-- check in the shared rank helper protects RLS policies and staff RPCs together.
create or replace function public.current_staff_role_rank()
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_profile_role text;
  v_rank integer := 0;
begin
  if v_actor is null then
    return 0;
  end if;

  begin
    select users.email
    into v_auth_email
    from auth.users
    where users.id = v_actor;
  exception
    when others then
      v_auth_email := null;
  end;

  select profiles.role
  into v_profile_role
  from public.profiles
  where profiles.id = v_actor
    and profiles.deleted_at is null;

  v_rank := greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, nullif(auth.jwt() ->> 'email', ''))
  );

  if v_rank >= 20 and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors factors
      where factors.user_id = v_actor
        and factors.status = 'verified'
    )
  ) then
    return 0;
  end if;

  return v_rank;
end;
$$;

create or replace function public.current_staff_role_key()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile_role text;
  v_rank integer := public.current_staff_role_rank();
begin
  if v_actor is null or v_rank < 20 then
    return 'player';
  end if;

  select profiles.role
  into v_profile_role
  from public.profiles
  where profiles.id = v_actor
    and profiles.deleted_at is null;

  if v_rank >= 120 then
    return 'owner';
  elsif v_rank >= 100 then
    return 'admin';
  elsif v_rank >= 80 then
    return 'manager';
  elsif lower(coalesce(v_profile_role, '')) = 'cashier' then
    return 'cashier';
  elsif v_rank >= 50 then
    return 'staff';
  elsif v_rank >= 20 then
    return 'viewer';
  end if;

  return 'player';
end;
$$;

revoke all on function public.current_staff_role_rank() from public, anon;
revoke all on function public.current_staff_role_key() from public, anon;
grant execute on function public.current_staff_role_rank() to authenticated, service_role;
grant execute on function public.current_staff_role_key() to authenticated, service_role;

-- Public bucket URLs bypass object SELECT policies. Narrow SELECT to the same
-- authenticated owner/manager predicates needed for safe upserts and listing.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  drop policy if exists "avatar images are public" on storage.objects;
  drop policy if exists "avatar reads by owner" on storage.objects;
  create policy "avatar reads by owner"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_manage_avatar_object_path(name)
  );

  drop policy if exists "club banners are public" on storage.objects;
  drop policy if exists "club banner reads by club managers" on storage.objects;
  create policy "club banner reads by club managers"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club-banners'
    and public.can_manage_club_banner_path(name)
  );

  drop policy if exists "staff game images are public" on storage.objects;
  drop policy if exists "staff game image reads by managers" on storage.objects;
  create policy "staff game image reads by managers"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'staff-game-images'
    and public.can_manage_staff_game_image_path(name)
  );

  alter policy "club banner uploads by club managers" on storage.objects to authenticated;
  alter policy "club banner updates by club managers" on storage.objects to authenticated;
  alter policy "club banner deletes by club managers" on storage.objects to authenticated;
  alter policy "staff game image uploads by managers" on storage.objects to authenticated;
  alter policy "staff game image updates by managers" on storage.objects to authenticated;
  alter policy "staff game image deletes by managers" on storage.objects to authenticated;
end $$;

-- Remove inherited PUBLIC execution from every public SECURITY DEFINER function,
-- then restore only app RPCs and functions that are dependencies of accessible
-- RLS policies/views. Internal helpers remain callable by their owning functions.
do $$
declare
  v_function record;
  v_authenticated_rpcs text[] := array[
    'claim_guest_ticket_booking',
    'clubs_list_page',
    'consume_booking_attempt_rate_limit',
    'consume_user_action_rate_limit',
    'create_friend_challenge',
    'create_guest_ticket_booking',
    'create_staff_order_with_payments',
    'create_ticket_booking',
    'current_staff_role_key',
    'current_staff_role_rank',
    'get_leaderboard_players',
    'get_leaderboard_players_page',
    'get_soft_deleted_records',
    'get_staff_daily_report',
    'guest_ticket_phone_account_status',
    'join_private_session_waitlist_with_code',
    'join_private_session_with_code',
    'profile_search',
    'public_profile_search',
    'restore_soft_deleted_record',
    'session_detail',
    'sessions_list_page',
    'set_session_participant_chapter_time',
    'set_staff_profile_role',
    'soft_delete_record',
    'soft_delete_tournament_records',
    'staff_award_profile_achievement',
    'staff_delete_profile_account',
    'staff_delete_session_operation',
    'staff_orders_page',
    'staff_remove_session_participant_operation',
    'staff_report_summary',
    'staff_update_session_operation',
    'staff_upsert_session_participant_operation',
    'sync_profile_public_snapshot',
    'ticket_automatic_discount_quote',
    'ticket_discount_code_quote',
    'ticket_loyalty_earn_quote',
    'ticket_loyalty_redemption_settings',
    'transfer_club_ownership'
  ];
  v_anon_rpcs text[] := array[
    'clubs_list_page',
    'consume_booking_attempt_rate_limit',
    'create_guest_ticket_booking',
    'get_leaderboard_players',
    'get_leaderboard_players_page',
    'guest_ticket_phone_account_status',
    'join_private_session_waitlist_with_code',
    'join_private_session_with_code',
    'session_detail',
    'sessions_list_page',
    'ticket_automatic_discount_quote',
    'ticket_loyalty_earn_quote'
  ];
begin
  for v_function in
    select procedures.oid,
           procedures.proname,
           procedures.oid::regprocedure as signature
    from pg_proc procedures
    join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_function.signature);
    execute format('grant execute on function %s to service_role', v_function.signature);

    if v_function.proname = any(v_authenticated_rpcs) or exists (
      select 1
      from pg_depend dependencies
      join pg_policy policies
        on dependencies.classid = 'pg_policy'::regclass
       and dependencies.objid = policies.oid
      where dependencies.refclassid = 'pg_proc'::regclass
        and dependencies.refobjid = v_function.oid
        and (
          policies.polroles = '{0}'::oid[]
          or 'authenticated'::regrole::oid = any(policies.polroles)
        )
    ) or exists (
      select 1
      from pg_depend dependencies
      join pg_rewrite rewrites
        on dependencies.classid = 'pg_rewrite'::regclass
       and dependencies.objid = rewrites.oid
      join pg_class relations on relations.oid = rewrites.ev_class
      where dependencies.refclassid = 'pg_proc'::regclass
        and dependencies.refobjid = v_function.oid
        and relations.relkind in ('v', 'm')
        and has_table_privilege('authenticated', relations.oid, 'SELECT')
    ) then
      execute format('grant execute on function %s to authenticated', v_function.signature);
    end if;

    if v_function.proname = any(v_anon_rpcs) or exists (
      select 1
      from pg_depend dependencies
      join pg_policy policies
        on dependencies.classid = 'pg_policy'::regclass
       and dependencies.objid = policies.oid
      where dependencies.refclassid = 'pg_proc'::regclass
        and dependencies.refobjid = v_function.oid
        and (
          policies.polroles = '{0}'::oid[]
          or 'anon'::regrole::oid = any(policies.polroles)
        )
    ) or exists (
      select 1
      from pg_depend dependencies
      join pg_rewrite rewrites
        on dependencies.classid = 'pg_rewrite'::regclass
       and dependencies.objid = rewrites.oid
      join pg_class relations on relations.oid = rewrites.ev_class
      where dependencies.refclassid = 'pg_proc'::regclass
        and dependencies.refobjid = v_function.oid
        and relations.relkind in ('v', 'm')
        and has_table_privilege('anon', relations.oid, 'SELECT')
    ) then
      execute format('grant execute on function %s to anon', v_function.signature);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
