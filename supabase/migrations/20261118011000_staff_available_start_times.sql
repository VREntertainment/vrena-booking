create function public.staff_available_start_times(p_date date,p_arena_id text,p_duration integer,p_arena_count integer,p_time time default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare venue text:=case when p_arena_id='cafe:arena-1' then 'cafe-des-stagiaires' else 'ha-do-centrosa' end; rank integer:=coalesce(public.current_staff_role_rank(),0); result jsonb;
begin
 if auth.uid() is null or rank<50 then raise exception 'Staff access required.'; end if;
 if rank<100 and not exists(select 1 from public.staff_access_locations() l where l.venue_key=venue) then raise exception 'Venue access required.'; end if;
 if p_date is null or p_arena_id not in ('arena-1','arena-2','cafe:arena-1') or p_duration is null or p_duration<1 or p_duration>1440 or p_arena_count is null or p_arena_count<1 or p_arena_count>(case when venue='cafe-des-stagiaires' then 1 else 2 end) then raise exception 'Invalid booking selection.'; end if;
 with times as (select (time '00:00'+make_interval(mins=>i*15))::time t from generate_series(0,95) i union select p_time where p_time is not null union select upper(r.during)::time from private.arena_reservations r where r.venue_key=venue and upper(r.during)::date=p_date)
 select jsonb_agg(jsonb_build_object('time',to_char(t,'HH24:MI'),'available',
  (p_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date or p_date+t >= now() at time zone 'Asia/Ho_Chi_Minh')
  and p_date+t+make_interval(mins=>p_duration)<=p_date+interval '1 day'
  and not exists(select 1 from private.arena_reservations r where r.venue_key=venue
   and (p_arena_count=2 or r.arena_number=case when p_arena_id='arena-2' then 2 else 1 end)
   and r.during && tsrange(p_date+t,p_date+t+make_interval(mins=>p_duration),'[)'))) order by t) into result from times;
 return result;
end $$;
revoke all on function public.staff_available_start_times(date,text,integer,integer,time) from public,anon;
grant execute on function public.staff_available_start_times(date,text,integer,integer,time) to authenticated;
