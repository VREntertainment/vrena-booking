begin;

create or replace function public.profile_has_account(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users users
    where users.id = p_profile_id
      and coalesce((users.raw_app_meta_data->>'guest_ticket')::boolean, false) is not true
  )
$$;

create or replace function public.ensure_guest_ticket_profile(
  p_guest_phone text,
  p_guest_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_guest_phone text := public.normalize_guest_ticket_phone(p_guest_phone);
  v_guest_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_guest_id uuid;
  v_guest_email text;
  v_profile public.profiles%rowtype;
begin
  v_guest_phone := regexp_replace(v_guest_phone, '(?!^)\+', '', 'g');

  if nullif(v_guest_phone, '') is null or length(regexp_replace(v_guest_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Enter a valid phone number.';
  end if;

  select *
  into v_profile
  from public.profiles profiles
  where profiles.phone = v_guest_phone
    and profiles.deleted_at is null
    and public.profile_has_account(profiles.id) is not true
  order by profiles.created_at desc nulls last
  limit 1
  for update;

  if found then
    if v_guest_name is not null and nullif(btrim(coalesce(v_profile.full_name, '')), '') is null then
      update public.profiles
      set full_name = v_guest_name,
          updated_at = now()
      where id = v_profile.id
      returning * into v_profile;
    end if;

    return v_profile;
  end if;

  v_guest_id := gen_random_uuid();
  v_guest_email := 'guest-ticket-' || replace(v_guest_id::text, '-', '') || '@vrena.guest.invalid';

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
  values (
    v_guest_id,
    'authenticated',
    'authenticated',
    v_guest_email,
    null,
    null,
    jsonb_build_object(
      'provider', 'guest_ticket',
      'providers', jsonb_build_array('guest_ticket'),
      'guest_ticket', true
    ),
    jsonb_build_object(
      'phone', v_guest_phone,
      'full_name', v_guest_name,
      'guest_ticket', true
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
  );

  insert into public.profiles (
    id,
    phone,
    full_name,
    nickname,
    email,
    avatar_url,
    avatar_emoji,
    avatar_initials,
    avatar_color,
    avatar_text_color,
    profile_motto,
    role,
    score_adjustment,
    anonymous_mode,
    marketing_consent
  ) values (
    v_guest_id,
    v_guest_phone,
    v_guest_name,
    null,
    null,
    null,
    null,
    null,
    '#3059ff',
    '#ffffff',
    null,
    'player',
    0,
    false,
    false
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

do $$
declare
  v_definition text;
  v_next_definition text;
  v_old_block text := $old$
  select *
  into v_customer
  from public.profiles
  where phone = v_guest_phone
    and deleted_at is null
    and not public.profile_has_account(profiles.id)
  order by created_at desc nulls last
  limit 1
  for update;

  if found then
    v_customer_id := v_customer.id;

    if v_guest_name is not null and nullif(btrim(coalesce(v_customer.full_name, '')), '') is null then
      update public.profiles
      set full_name = v_guest_name
      where id = v_customer_id;
      v_customer.full_name := v_guest_name;
    end if;
  else
    v_customer_id := gen_random_uuid();

    insert into public.profiles (
      id,
      phone,
      full_name,
      nickname,
      email,
      avatar_url,
      avatar_emoji,
      avatar_initials,
      avatar_color,
      avatar_text_color,
      profile_motto,
      role,
      score_adjustment,
      anonymous_mode,
      marketing_consent
    ) values (
      v_customer_id,
      v_guest_phone,
      v_guest_name,
      null,
      null,
      null,
      null,
      null,
      '#3059ff',
      '#ffffff',
      null,
      'player',
      0,
      false,
      false
    )
    returning * into v_customer;
  end if;
$old$;
  v_new_block text := $new$
  select *
  into v_customer
  from public.ensure_guest_ticket_profile(v_guest_phone, v_guest_name);

  v_customer_id := v_customer.id;
$new$;
begin
  select pg_get_functiondef('public.create_guest_ticket_booking(text,date,time,integer,integer,integer,text[],integer,integer,text,text)'::regprocedure)
  into v_definition;

  v_next_definition := replace(v_definition, v_old_block, v_new_block);

  if v_next_definition = v_definition then
    raise exception 'Could not patch create_guest_ticket_booking guest profile creation.';
  end if;

  execute v_next_definition;
end $$;

revoke all on function public.profile_has_account(uuid) from public, anon, authenticated;
revoke all on function public.ensure_guest_ticket_profile(text, text) from public, anon, authenticated;
revoke all on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) from public, anon, authenticated;

grant execute on function public.create_guest_ticket_booking(text, date, time, integer, integer, integer, text[], integer, integer, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
