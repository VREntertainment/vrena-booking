create table private.staff_booking_contact_overrides (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  details jsonb not null
);
alter table private.staff_booking_contact_overrides enable row level security;
revoke all on table private.staff_booking_contact_overrides from public, anon, authenticated;

create function private.save_staff_booking_contact(p_session_id uuid, p_contact jsonb)
returns void language plpgsql set search_path = '' as $function$
declare
  v_name text := nullif(btrim(p_contact->>'name'), '');
  v_email text := nullif(btrim(p_contact->>'email'), '');
  v_phone text := nullif(btrim(p_contact->>'phone'), '');
  v_details jsonb := '{}'::jsonb;
begin
  if p_contact is null then return; end if;
  if jsonb_typeof(p_contact) <> 'object' or (p_contact - array['name','email','phone']) <> '{}'::jsonb
    or exists (select 1 from jsonb_each(p_contact) as entry where jsonb_typeof(entry.value) not in ('string','null')) then
    raise exception 'Invalid booking client details.';
  end if;
  if p_contact = '{}'::jsonb then return; end if;
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50
    or not exists(select 1 from staff_location_scope.sessions where id=p_session_id and deleted_at is null) then
    raise exception 'Staff access required.';
  end if;
  if char_length(v_name)>120 then raise exception 'Client name is too long.'; end if;
  if v_email is not null and (char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Enter a valid client email or leave it blank.';
  end if;
  if v_phone is not null and (char_length(v_phone)>32 or v_phone !~ '^\+?[0-9(). -]+$'
    or char_length(regexp_replace(v_phone,'[^0-9]','','g')) not between 8 and 15) then
    raise exception 'Enter a valid client phone number or leave it blank.';
  end if;
  if private.reservation_contact_is_official(v_email,v_phone) then
    raise exception 'Enter the client contact details without VRena company contacts.';
  end if;
  if p_contact ? 'name' then v_details := v_details || jsonb_build_object('name',v_name); end if;
  if p_contact ? 'email' then v_details := v_details || jsonb_build_object('email',v_email); end if;
  if p_contact ? 'phone' then v_details := v_details || jsonb_build_object('phone',v_phone); end if;

  insert into private.staff_booking_contact_overrides as saved(session_id,details)
  values(p_session_id,v_details)
  on conflict (session_id) do update set details=saved.details || excluded.details;

  update public.staff_orders
  set customer_name=case when p_contact ? 'name' then v_name else customer_name end,
      customer_email=case when p_contact ? 'email' then v_email else customer_email end,
      customer_phone=case when p_contact ? 'phone' then v_phone else customer_phone end
  where session_id=p_session_id;
end;
$function$;
revoke all on function private.save_staff_booking_contact(uuid,jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_get_booking_details(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 creator_name text;
 creator_via_pin boolean;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if not exists(select 1 from staff_location_scope.sessions where id=p_session_id and deleted_at is null) then raise exception 'Booking not found.'; end if;

 -- Use creation events only: later edits, payments and PIN switches must not
 -- change who originally reserved. Resolve the PIN operator separately from
 -- the shared logged-in account recorded as the audit actor.
 select coalesce(nullif(trim(e.legal_name),''), nullif(trim(p.full_name),''), 'Unknown staff'), a.operator_session_id is not null
 into creator_name, creator_via_pin
 from (
   select a.* from public.audit_logs a
   where a.entity_type='sessions' and a.entity_id=p_session_id and a.action='kiosk_insert'
   union all
   select a.* from public.staff_orders o
   join public.audit_logs a on a.entity_type='staff_orders' and a.entity_id=o.id and a.action='order_created'
   where o.session_id=p_session_id
     and a.created_at <= (select s.created_at + interval '5 seconds' from public.sessions s where s.id=p_session_id)
 ) a
 left join private.staff_kiosk_operator_sessions k on k.id=a.operator_session_id
 left join lateral (
   select case when a.operator_session_id is null then a.actor_user_id
     else coalesce(k.operator_profile_id,
       case when pg_input_is_valid(a.new_value->>'booking_operator_profile_id', 'uuid')
         then (a.new_value->>'booking_operator_profile_id')::uuid end,
       case when a.actor_user_id is distinct from a.auth_user_id then a.actor_user_id end)
   end as profile_id
 ) creator on true
 left join public.profiles p on p.id=creator.profile_id
 left join public.staff_employee_profiles e on e.profile_id=creator.profile_id and a.operator_session_id is not null
 where creator.profile_id is not null
 order by (a.operator_session_id is not null) desc, a.created_at, case when a.entity_type='sessions' then 0 else 1 end, a.id
 limit 1;

 return (select to_jsonb(s)||private.calendar_booking_metadata(s.id)||jsonb_build_object(
   'booking_creator_name', creator_name,
   'booking_creator_via_pin', coalesce(creator_via_pin,false),
   'booking_arena_ids', coalesce((
     select jsonb_agg(case when s.venue_key='cafe-des-stagiaires' then 'cafe:arena-1' else 'arena-'||a.arena_number end order by a.arena_number)
     from private.arena_reservations a where a.session_id=s.id
   ), '[]'::jsonb),
   'booking_client', jsonb_build_object(
     'name', coalesce(nullif(o.customer_name,''), nullif(p.full_name,''), nullif(p.nickname,'')),
     'email', coalesce(nullif(g.email,''), nullif(o.customer_email,''), nullif(p.email,'')),
     'phone', coalesce(nullif(g.phone,''), nullif(o.customer_phone,''), nullif(p.phone,'')),
     'loyalty_points', case when g.session_id is null and p.id is not null and not coalesce(p.is_hr_record_only,false)
       and not coalesce(o.customer_name='Guest',false) then p.loyalty_points_total end
   ) || coalesce(c.details,'{}'::jsonb)
 ) from public.sessions s
 left join lateral (select o.* from public.staff_orders o where o.session_id=s.id order by o.created_at,o.id limit 1) o on true
 left join private.guest_reservation_contacts g on g.session_id=s.id
 left join private.staff_booking_contact_overrides c on c.session_id=s.id
 left join public.profiles p on p.id=coalesce(o.customer_id,s.ticket_customer_id,case when s.booking_source='website' then s.owner_id end)
 where s.id=p_session_id);
end $function$;

CREATE OR REPLACE FUNCTION public.staff_update_booking_details(p_session_id uuid, p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 result:=private.staff_update_booking_details(p_session_id,p_booking-'booking_client_contact');
 perform private.save_booking_client_confirmation(p_session_id,p_booking);
 perform private.save_staff_booking_contact(p_session_id,p_booking->'booking_client_contact');
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.staff_update_sim_racing_booking(p_session_id uuid, p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 result:=private.staff_update_sim_racing_booking(p_session_id,p_booking-'booking_client_contact');
 perform private.save_booking_client_confirmation(p_session_id,p_booking);
 perform private.save_staff_booking_contact(p_session_id,p_booking->'booking_client_contact');
 return result;
end $function$;
