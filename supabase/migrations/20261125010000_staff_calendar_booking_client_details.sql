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
 -- change who originally reserved. Audit actor IDs retain PIN attribution even
 -- after the short-lived private operator session has been removed.
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
 left join public.profiles p on p.id=a.actor_user_id
 left join public.staff_employee_profiles e on e.profile_id=a.actor_user_id and a.operator_session_id is not null
 where a.actor_user_id is not null
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
   )
 ) from public.sessions s
 left join lateral (select o.* from public.staff_orders o where o.session_id=s.id order by o.created_at,o.id limit 1) o on true
 left join private.guest_reservation_contacts g on g.session_id=s.id
 left join public.profiles p on p.id=coalesce(o.customer_id,s.ticket_customer_id,case when s.booking_source='website' then s.owner_id end)
 where s.id=p_session_id);
end $function$;
