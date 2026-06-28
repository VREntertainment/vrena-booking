-- Local/staging only. Do not run this against production.
--
-- Creates or refreshes the dedicated Playwright admin user used by E2E tests.
-- Run in the Supabase SQL editor or with `supabase db query` on a non-production project:
--
-- select public.vrena_e2e_prepare_admin(
--   'e2e-admin@vrena.local',
--   'replace-with-a-long-test-only-password',
--   true
-- );
--
-- Then set matching local env vars:
-- E2E_ADMIN_EMAIL=e2e-admin@vrena.local
-- E2E_ADMIN_PASSWORD=replace-with-a-long-test-only-password

create extension if not exists pgcrypto with schema extensions;

create or replace function public.vrena_e2e_prepare_admin(
  p_email text,
  p_password text,
  p_allow_non_production boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_user_id uuid;
  v_profile_phone text;
begin
  if p_allow_non_production is distinct from true then
    raise exception 'Refusing to create E2E admin. Pass true only on local/staging.';
  end if;

  if v_email is null or v_email !~ '^[a-z0-9._%+\-]+@vrena\.local$' then
    raise exception 'E2E admin email must use the @vrena.local test domain.';
  end if;

  if coalesce(length(p_password), 0) < 12 then
    raise exception 'E2E admin password must be at least 12 characters.';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Missing required table auth.users.';
  end if;

  if to_regclass('auth.identities') is null then
    raise exception 'Missing required table auth.identities.';
  end if;

  select id
  into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  v_user_id := coalesce(v_user_id, gen_random_uuid());
  v_profile_phone := '+84000' || substring(regexp_replace(v_user_id::text, '[^0-9]', '', 'g') || '0000000000' from 1 for 8);

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    reauthentication_token
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'e2e_test_user', true
    ),
    jsonb_build_object(
      'full_name', 'E2E Admin',
      'nickname', 'E2E Admin',
      'name', 'E2E Admin',
      'e2e_test_user', true
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    0,
    ''
  )
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    role,
    updated_at
  ) values (
    v_user_id,
    v_profile_phone,
    'E2E Admin',
    'E2E Admin',
    v_email,
    'admin',
    now()
  )
  on conflict (id) do update
  set phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
      full_name = 'E2E Admin',
      nickname = 'E2E Admin',
      email = excluded.email,
      role = 'admin',
      deleted_at = null,
      banned_at = null,
      updated_at = now();

  return jsonb_build_object(
    'created_or_updated', true,
    'profile_id', v_user_id,
    'email', v_email,
    'role', 'admin'
  );
end;
$$;

revoke all on function public.vrena_e2e_prepare_admin(text, text, boolean) from public, anon, authenticated;
grant execute on function public.vrena_e2e_prepare_admin(text, text, boolean) to service_role;
