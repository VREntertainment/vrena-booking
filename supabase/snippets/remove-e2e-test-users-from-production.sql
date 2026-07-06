-- Production cleanup for accidental E2E test-user fixture execution.
--
-- Review the NOTICE output before and after running. This script is intentionally
-- narrow: it targets only known @vrena.local E2E accounts and auth users marked
-- with the e2e_test_user metadata flag.
--
-- Intended use:
--   Supabase production SQL editor, run as a privileged/service-role operator.
--
-- Cleans:
--   - public.vrena_e2e_prepare_test_user(...)
--   - public.vrena_e2e_prepare_admin(...)
--   - login/session/passkey/token access for matching E2E auth users
--   - active profile access for matching E2E profiles
--
-- It does not hard-delete auth.users rows because public.profiles has an
-- ON DELETE CASCADE foreign key to auth.users, and profile deletes can cascade
-- app data. The auth records are disabled and anonymized instead.

begin;

drop function if exists public.vrena_e2e_prepare_test_user(text, text, text, text, boolean);
drop function if exists public.vrena_e2e_prepare_admin(text, text, boolean);

do $$
declare
  v_neutralized_profiles integer := 0;
  v_deleted_identities integer := 0;
  v_deleted_mfa_challenges integer := 0;
  v_deleted_mfa_factors integer := 0;
  v_deleted_oauth_authorizations integer := 0;
  v_deleted_oauth_consents integer := 0;
  v_deleted_one_time_tokens integer := 0;
  v_deleted_refresh_tokens integer := 0;
  v_deleted_sessions integer := 0;
  v_deleted_webauthn_challenges integer := 0;
  v_deleted_webauthn_credentials integer := 0;
  v_disabled_auth_users integer := 0;
  v_emails text[];
begin
  if to_regclass('auth.users') is null then
    raise exception 'Missing required table auth.users.';
  end if;

  create temp table if not exists vrena_e2e_cleanup_user_ids (
    id uuid primary key
  ) on commit drop;

  truncate table vrena_e2e_cleanup_user_ids;

  insert into vrena_e2e_cleanup_user_ids (id)
  select users.id
  from auth.users users
  where lower(users.email) in (
    'e2e-viewer@vrena.local',
    'e2e-staff@vrena.local',
    'e2e-admin@vrena.local'
  )
  or (
    lower(coalesce(users.email, '')) like '%@vrena.local'
    and (
      coalesce((users.raw_app_meta_data->>'e2e_test_user')::boolean, false)
      or coalesce((users.raw_user_meta_data->>'e2e_test_user')::boolean, false)
    )
  );

  select array_agg(lower(users.email) order by lower(users.email))
  into v_emails
  from auth.users users
  join vrena_e2e_cleanup_user_ids cleanup on cleanup.id = users.id;

  raise notice 'E2E users selected for deletion: %', coalesce(v_emails::text, '{}');

  if to_regclass('auth.identities') is not null then
    delete from auth.identities identities
    using vrena_e2e_cleanup_user_ids cleanup
    where identities.user_id = cleanup.id;
    get diagnostics v_deleted_identities = row_count;
  end if;

  if to_regclass('auth.mfa_challenges') is not null and to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_challenges challenges
    using auth.mfa_factors factors,
      vrena_e2e_cleanup_user_ids cleanup
    where challenges.factor_id = factors.id
      and factors.user_id = cleanup.id;
    get diagnostics v_deleted_mfa_challenges = row_count;
  end if;

  if to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_factors factors
    using vrena_e2e_cleanup_user_ids cleanup
    where factors.user_id = cleanup.id;
    get diagnostics v_deleted_mfa_factors = row_count;
  end if;

  if to_regclass('auth.oauth_authorizations') is not null then
    delete from auth.oauth_authorizations authorizations
    using vrena_e2e_cleanup_user_ids cleanup
    where authorizations.user_id = cleanup.id;
    get diagnostics v_deleted_oauth_authorizations = row_count;
  end if;

  if to_regclass('auth.oauth_consents') is not null then
    delete from auth.oauth_consents consents
    using vrena_e2e_cleanup_user_ids cleanup
    where consents.user_id = cleanup.id;
    get diagnostics v_deleted_oauth_consents = row_count;
  end if;

  if to_regclass('auth.one_time_tokens') is not null then
    delete from auth.one_time_tokens tokens
    using vrena_e2e_cleanup_user_ids cleanup
    where tokens.user_id = cleanup.id;
    get diagnostics v_deleted_one_time_tokens = row_count;
  end if;

  if to_regclass('auth.refresh_tokens') is not null and to_regclass('auth.sessions') is not null then
    delete from auth.refresh_tokens tokens
    using auth.sessions sessions,
      vrena_e2e_cleanup_user_ids cleanup
    where tokens.session_id = sessions.id
      and sessions.user_id = cleanup.id;
    get diagnostics v_deleted_refresh_tokens = row_count;
  end if;

  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions sessions
    using vrena_e2e_cleanup_user_ids cleanup
    where sessions.user_id = cleanup.id;
    get diagnostics v_deleted_sessions = row_count;
  end if;

  if to_regclass('auth.webauthn_challenges') is not null then
    delete from auth.webauthn_challenges challenges
    using vrena_e2e_cleanup_user_ids cleanup
    where challenges.user_id = cleanup.id;
    get diagnostics v_deleted_webauthn_challenges = row_count;
  end if;

  if to_regclass('auth.webauthn_credentials') is not null then
    delete from auth.webauthn_credentials credentials
    using vrena_e2e_cleanup_user_ids cleanup
    where credentials.user_id = cleanup.id;
    get diagnostics v_deleted_webauthn_credentials = row_count;
  end if;

  if to_regclass('public.profiles') is not null then
    update public.profiles profiles
    set email = null,
        full_name = 'Removed E2E test user',
        nickname = null,
        role = 'player',
        deleted_at = coalesce(profiles.deleted_at, now()),
        delete_reason = 'Removed accidental E2E test user access from production.',
        banned_at = coalesce(profiles.banned_at, now()),
        ban_reason = 'Removed accidental E2E test user access from production.',
        updated_at = now()
    from vrena_e2e_cleanup_user_ids cleanup
    where profiles.id = cleanup.id;
    get diagnostics v_neutralized_profiles = row_count;
  end if;

  update auth.users users
  set email = null,
      encrypted_password = null,
      email_confirmed_at = null,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      phone = null,
      phone_confirmed_at = null,
      phone_change = '',
      phone_change_token = '',
      email_change_token_current = '',
      reauthentication_token = '',
      banned_until = 'infinity'::timestamptz,
      deleted_at = coalesce(users.deleted_at, now()),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'disabled',
        'providers', jsonb_build_array(),
        'disabled_e2e_user', true,
        'disabled_reason', 'Removed accidental E2E test user access from production.'
      ),
      raw_user_meta_data = jsonb_build_object(
        'disabled_e2e_user', true,
        'disabled_reason', 'Removed accidental E2E test user access from production.'
      ),
      updated_at = now()
  from vrena_e2e_cleanup_user_ids cleanup
  where users.id = cleanup.id;
  get diagnostics v_disabled_auth_users = row_count;

  raise notice 'Cleaned profiles=%, identities=%, mfa_challenges=%, mfa_factors=%, oauth_authorizations=%, oauth_consents=%, one_time_tokens=%, refresh_tokens=%, sessions=%, webauthn_challenges=%, webauthn_credentials=%, disabled_auth_users=%',
    v_neutralized_profiles,
    v_deleted_identities,
    v_deleted_mfa_challenges,
    v_deleted_mfa_factors,
    v_deleted_oauth_authorizations,
    v_deleted_oauth_consents,
    v_deleted_one_time_tokens,
    v_deleted_refresh_tokens,
    v_deleted_sessions,
    v_deleted_webauthn_challenges,
    v_deleted_webauthn_credentials,
    v_disabled_auth_users;
end;
$$;

commit;
