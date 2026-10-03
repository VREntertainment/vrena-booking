begin;

create or replace function private.staff_save_client_profile_v4(
  p_profile_id uuid, p_loyalty_points integer, p_overall jsonb, p_games jsonb,
  p_achievement_changes jsonb default '[]', p_note text default null,
  p_session_ids uuid[] default array[]::uuid[], p_details jsonb default null,
  p_save_stats boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_key text;
  v_details jsonb := p_details;
  v_result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(), 0) < 50 then
    raise exception 'Staff access required.';
  end if;
  select * into v_before from public.profiles where id=p_profile_id and deleted_at is null for update;
  if not found then raise exception 'Player profile not found.'; end if;
  if p_details is not null then
    if jsonb_typeof(p_details) <> 'object' then raise exception 'Invalid client details.'; end if;
    for v_key in select jsonb_object_keys(p_details) loop
      if not v_key = any(array['full_name','nickname','phone','email','birthday','gender','profile_motto','avatar_url','avatar_emoji','avatar_initials','avatar_color','avatar_text_color','anonymous_mode']) then
        raise exception 'This profile field cannot be edited here: %', v_key;
      end if;
      if v_key <> 'anonymous_mode' then
        if jsonb_typeof(p_details->v_key) not in ('string','null') then raise exception 'Invalid client detail: %', v_key; end if;
        if length(p_details->>v_key) > (case when v_key='avatar_url' then 2048 else 200 end) then raise exception 'Client detail is too long: %', v_key; end if;
        v_details := jsonb_set(v_details, array[v_key], coalesce(to_jsonb(nullif(btrim(p_details->>v_key),'')), 'null'));
      elsif jsonb_typeof(p_details->v_key) <> 'boolean' then raise exception 'Invalid anonymous mode.';
      end if;
    end loop;
    v_after := jsonb_populate_record(v_before, v_details);
    if v_after.full_name is null then raise exception 'Client name is required.'; end if;
    if v_after.birthday > current_date or v_after.birthday < date '1900-01-01' then raise exception 'Enter a valid date of birth.'; end if;
    if v_after.email is not null and v_after.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid contact email.'; end if;
    if v_after.phone is not null and v_after.phone !~ '^\+?[0-9 ()-]{6,25}$' then raise exception 'Enter a valid phone number.'; end if;
    if v_after.avatar_url is not null and v_after.avatar_url !~ '^https://' then raise exception 'Avatar image must use an HTTPS URL.'; end if;
    if (v_after.avatar_color is not null and v_after.avatar_color !~ '^#[0-9a-fA-F]{6}$') or (v_after.avatar_text_color is not null and v_after.avatar_text_color !~ '^#[0-9a-fA-F]{6}$') then raise exception 'Avatar colors must use six-digit hex colors.'; end if;
    update public.profiles set full_name=v_after.full_name, nickname=v_after.nickname, phone=v_after.phone,
      email=v_after.email, birthday=v_after.birthday, gender=v_after.gender, profile_motto=v_after.profile_motto,
      avatar_url=v_after.avatar_url, avatar_emoji=v_after.avatar_emoji, avatar_initials=v_after.avatar_initials,
      avatar_color=v_after.avatar_color, avatar_text_color=v_after.avatar_text_color, anonymous_mode=v_after.anonymous_mode,
      updated_at=now() where id=p_profile_id returning * into v_after;
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
      values(auth.uid(),'staff_client_details_updated','profiles',p_profile_id,
        (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(v_before)) where key in (select jsonb_object_keys(p_details))),
        (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(v_after)) where key in (select jsonb_object_keys(p_details))));
  end if;
  if p_save_stats then
    v_result := public.staff_save_player_achievement_profile_v3(p_profile_id,p_loyalty_points,p_overall,p_games,p_achievement_changes,p_note,p_session_ids);
  end if;
  return v_result || jsonb_build_object('profile_id',p_profile_id);
end;
$$;
revoke all on function private.staff_save_client_profile_v4(uuid,integer,jsonb,jsonb,jsonb,text,uuid[],jsonb,boolean) from public,anon;
grant execute on function private.staff_save_client_profile_v4(uuid,integer,jsonb,jsonb,jsonb,text,uuid[],jsonb,boolean) to authenticated;

create or replace function public.staff_save_client_profile_v4(
  p_profile_id uuid, p_loyalty_points integer, p_overall jsonb, p_games jsonb,
  p_achievement_changes jsonb default '[]', p_note text default null,
  p_session_ids uuid[] default array[]::uuid[], p_details jsonb default null,
  p_save_stats boolean default true
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.staff_save_client_profile_v4(p_profile_id,p_loyalty_points,p_overall,p_games,p_achievement_changes,p_note,p_session_ids,p_details,p_save_stats);
$$;
revoke all on function public.staff_save_client_profile_v4(uuid,integer,jsonb,jsonb,jsonb,text,uuid[],jsonb,boolean) from public,anon;
grant execute on function public.staff_save_client_profile_v4(uuid,integer,jsonb,jsonb,jsonb,text,uuid[],jsonb,boolean) to authenticated;
commit;
