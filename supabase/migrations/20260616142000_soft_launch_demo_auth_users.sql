create or replace function public.vrena_soft_launch_prepare_demo_auth_users(
  p_allow_production_seed boolean default false,
  p_seed_batch text default 'soft-launch-2026-06-16'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch demo auth preparation refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Missing required table auth.users.';
  end if;

  drop table if exists pg_temp.vrena_seed_auth_users;
  create temp table vrena_seed_auth_users (
    id uuid primary key,
    phone text not null,
    full_name text not null,
    nickname text not null,
    email text not null
  ) on commit drop;

  insert into vrena_seed_auth_users values
    ('00000000-0000-4000-8000-000000000101', '+84000000101', 'VRena Rookie', 'Rookie', 'softlaunch-rookie@vrena.demo'),
    ('00000000-0000-4000-8000-000000000102', '+84000000102', 'Ha Do Hunter', 'Ha Do', 'softlaunch-hado@vrena.demo'),
    ('00000000-0000-4000-8000-000000000103', '+84000000103', 'Neon Noodle', 'Neon', 'softlaunch-neon@vrena.demo'),
    ('00000000-0000-4000-8000-000000000104', '+84000000104', 'Byte Bender', 'Byte', 'softlaunch-byte@vrena.demo'),
    ('00000000-0000-4000-8000-000000000105', '+84000000105', 'Saigon Spark', 'Saigon', 'softlaunch-saigon@vrena.demo'),
    ('00000000-0000-4000-8000-000000000106', '+84000000106', 'Arena Ace', 'Ace', 'softlaunch-ace@vrena.demo'),
    ('00000000-0000-4000-8000-000000000107', '+84000000107', 'Joller Runner', 'Joller', 'softlaunch-joller@vrena.demo'),
    ('00000000-0000-4000-8000-000000000108', '+84000000108', 'Arc Whisper', 'Arc', 'softlaunch-arc@vrena.demo'),
    ('00000000-0000-4000-8000-000000000109', '+84000000109', 'Paint Pop', 'Paint', 'softlaunch-paint@vrena.demo'),
    ('00000000-0000-4000-8000-000000000110', '+84000000110', 'Snow Slider', 'Snow', 'softlaunch-snow@vrena.demo'),
    ('00000000-0000-4000-8000-000000000111', '+84000000111', 'Office Ninja', 'Office', 'softlaunch-office@vrena.demo'),
    ('00000000-0000-4000-8000-000000000112', '+84000000112', 'Crown Chaser', 'Crown', 'softlaunch-crown@vrena.demo');

  if exists (
    select 1
    from auth.users u
    join vrena_seed_auth_users seed on seed.id = u.id
    where coalesce((u.raw_app_meta_data->>'seed_demo')::boolean, false) is not true
  ) then
    raise exception 'A soft-launch demo auth UUID already belongs to a non-demo auth user. Aborting.';
  end if;

  if exists (
    select 1
    from auth.users u
    join vrena_seed_auth_users seed on lower(u.email) = lower(seed.email)
    where u.id <> seed.id
  ) then
    raise exception 'A soft-launch demo email already belongs to another auth user. Aborting.';
  end if;

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
  )
  select
    seed.id,
    'authenticated',
    'authenticated',
    seed.email,
    null,
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'seed_demo', true,
      'seed_batch', p_seed_batch
    ),
    jsonb_build_object(
      'full_name', seed.full_name,
      'nickname', seed.nickname,
      'seed_demo', true,
      'seed_batch', p_seed_batch
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
  from vrena_seed_auth_users seed
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now()
  where coalesce((auth.users.raw_app_meta_data->>'seed_demo')::boolean, false) is true;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'prepared_demo_auth_users', v_inserted,
    'seed_batch', p_seed_batch
  );
end;
$$;

revoke all on function public.vrena_soft_launch_prepare_demo_auth_users(boolean, text) from public, anon, authenticated;
grant execute on function public.vrena_soft_launch_prepare_demo_auth_users(boolean, text) to service_role;

create or replace function public.vrena_soft_launch_reset_seed_with_demo_auth(
  p_allow_production_seed boolean default false,
  p_seed_batch text default 'soft-launch-2026-06-16'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_result jsonb;
  v_seed_result jsonb;
begin
  if p_allow_production_seed is distinct from true then
    raise exception 'Soft-launch reset refused. Set ALLOW_PRODUCTION_SEED=true in the runner before calling this function.';
  end if;

  v_auth_result := public.vrena_soft_launch_prepare_demo_auth_users(p_allow_production_seed, p_seed_batch);
  v_seed_result := public.vrena_soft_launch_reset_seed(p_allow_production_seed, p_seed_batch);

  return v_auth_result || v_seed_result;
end;
$$;

revoke all on function public.vrena_soft_launch_reset_seed_with_demo_auth(boolean, text) from public, anon, authenticated;
grant execute on function public.vrena_soft_launch_reset_seed_with_demo_auth(boolean, text) to service_role;
