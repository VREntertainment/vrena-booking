begin;
create schema staff_location_scope;
revoke all on schema staff_location_scope from public,anon,authenticated;

-- Locations are a catalog, not an enum: employee access can grow with the business.
create table public.staff_locations (
  venue_key text primary key,
  name text not null,
  active boolean not null default true
);
insert into public.staff_locations(venue_key,name) values
 ('ha-do-centrosa','VRena Hà Đô Centrosa'),('cafe-des-stagiaires','VRena Thảo Điền');
create table public.staff_employee_locations (
  profile_id uuid not null references public.staff_employee_profiles(profile_id) on delete cascade,
  venue_key text not null references public.staff_locations(venue_key),
  primary key(profile_id,venue_key)
);
create index staff_employee_locations_venue on public.staff_employee_locations(venue_key,profile_id);
insert into public.staff_employee_locations
select profile_id,case main_work_location when 'HaDo' then 'ha-do-centrosa' when 'CS' then 'cafe-des-stagiaires' end
from public.staff_employee_profiles where main_work_location in ('HaDo','CS') and deleted_at is null;
-- VRE/unknown locations deliberately receive no access until an administrator assigns it.
alter table public.staff_locations enable row level security;
alter table public.staff_employee_locations enable row level security;
revoke all on public.staff_locations,public.staff_employee_locations from anon,authenticated;
grant select on public.staff_locations,public.staff_employee_locations to authenticated;
grant all on public.staff_locations,public.staff_employee_locations to service_role;
create policy locations_read on public.staff_locations for select to authenticated using (public.current_staff_role_rank() >= 20);
create policy assignments_read on public.staff_employee_locations for select to authenticated
using (public.current_staff_role_rank() >= 100 or profile_id=public.current_staff_actor_profile_id());

-- Resolve the shared login from current account state, as the role verifier does.
create or replace function public.current_staff_actor_profile_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=auth.uid() and lower(email)='contact@vre-vietnam.com') then
   return private.current_staff_kiosk_operator_profile_id();
 end if;
 return auth.uid();
end $$;

create function private.staff_location_scoped() returns boolean language sql stable security definer set search_path='' as $$
 select public.current_staff_role_rank() between 20 and 99
$$;
create function private.staff_location_allowed(p_venue text) returns boolean language sql stable security definer set search_path='' as $$
 select public.current_staff_role_rank() >= 100 or (public.current_staff_role_rank() >= 20 and exists(
 select 1 from public.staff_employee_locations a
 join public.staff_employee_profiles e on e.profile_id=a.profile_id
 join public.staff_locations l on l.venue_key=a.venue_key
 where a.profile_id=public.current_staff_actor_profile_id() and a.venue_key=p_venue
 and e.active and e.deleted_at is null and l.active))
$$;
create function private.staff_location_session_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sessions s where s.id=p_id and private.staff_location_allowed(s.venue_key))
$$;
create function private.staff_location_order_allowed(p_session uuid,p_arena text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_session is not null then private.staff_location_session_allowed(p_session)
 else private.staff_location_allowed(case when p_arena='cafe:arena-1' then 'cafe-des-stagiaires'
 when p_arena in ('arena-1','arena-2','sim-racing-1','sim-racing-2') then 'ha-do-centrosa' else null end) end
$$;
-- Preserve newly created staff customer records before their first order exists.
create table private.staff_customer_locations (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 venue_key text not null references public.staff_locations(venue_key),primary key(profile_id,venue_key)
);
revoke all on private.staff_customer_locations from public,anon,authenticated;
create function private.staff_location_profile_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_id=auth.uid() or p_id=public.current_staff_actor_profile_id() or exists(
 select 1 from private.staff_customer_locations c where c.profile_id=p_id and private.staff_location_allowed(c.venue_key))
 or exists(select 1 from public.staff_orders o where o.customer_id=p_id and private.staff_location_order_allowed(o.session_id,o.arena_id))
 or exists(select 1 from public.session_participants p join public.sessions s on s.id=p.session_id
 where p.profile_id=p_id and p.deleted_at is null and private.staff_location_allowed(s.venue_key))
 or exists(select 1 from public.sessions s where (s.owner_id=p_id or s.ticket_customer_id=p_id) and private.staff_location_allowed(s.venue_key))
$$;
create function private.staff_location_row_allowed(p_table text,p_row jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not private.staff_location_scoped() then return true; end if;
 case p_table
 when 'sessions' then return private.staff_location_allowed(p_row->>'venue_key');
 when 'staff_orders' then return private.staff_location_order_allowed((p_row->>'session_id')::uuid,p_row->>'arena_id');
 when 'staff_order_payments' then return exists(select 1 from public.staff_orders o where o.id=(p_row->>'order_id')::uuid and private.staff_location_order_allowed(o.session_id,o.arena_id));
 when 'profiles' then return private.staff_location_profile_allowed((p_row->>'id')::uuid);
 when 'blocked_times' then return private.staff_location_allowed('ha-do-centrosa');
 when 'player_stat_overrides','profile_achievement_awards' then return private.staff_location_profile_allowed((p_row->>'profile_id')::uuid);
 else return private.staff_location_session_allowed((p_row->>'session_id')::uuid);
 end case;
end $$;

create function public.staff_access_locations() returns table(venue_key text,name text) language sql stable security definer set search_path='' as $$
 select l.venue_key,l.name from public.staff_locations l where l.active and private.staff_location_allowed(l.venue_key) order by l.name
$$;
create function public.staff_set_employee_locations(p_profile_id uuid,p_venue_keys text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(public.current_staff_role_rank(),0)<100 then raise exception 'Administrator access required.'; end if;
 perform 1 from public.staff_employee_profiles where profile_id=p_profile_id and deleted_at is null for update;
 if not found then raise exception 'Employee not found.'; end if;
 if p_venue_keys is null or exists(select 1 from unnest(p_venue_keys) k where k is null or not exists(select 1 from public.staff_locations l where l.venue_key=k and l.active)) then
 raise exception 'Choose valid locations.'; end if;
 delete from public.staff_employee_locations where profile_id=p_profile_id;
 insert into public.staff_employee_locations select p_profile_id,k from (select distinct unnest(p_venue_keys) k) x;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value)
 values(auth.uid(),'staff_locations_updated','staff_employee_profiles',p_profile_id,jsonb_build_object('venue_keys',p_venue_keys));
end $$;
revoke all on function public.staff_access_locations(),public.staff_set_employee_locations(uuid,text[]) from public,anon;
grant execute on function public.staff_access_locations(),public.staff_set_employee_locations(uuid,text[]) to authenticated,service_role;

-- Restrictive policies intersect every existing permissive policy. They also cover
-- named rank-20 staff, not only PIN operators. Public/customer permissions remain intact.
do $$ declare t text; begin
 foreach t in array array['sessions','staff_orders','staff_order_payments','profiles','session_participants','staff_session_games_played','session_participant_chapter_times','blocked_times','player_stat_overrides','profile_achievement_awards','session_invites','session_messages','session_waitlist','tournament_audit_log','tournament_editors','tournament_matches','tournament_pool_entries','tournament_pools','tournament_teams'] loop
 execute format('create policy staff_location_boundary on public.%I as restrictive for all to authenticated using (private.staff_location_row_allowed(%L,to_jsonb(%I.*))) with check (private.staff_location_row_allowed(%L,to_jsonb(%I.*)))',t,t,t,t,t);
 -- Definer RPCs need the identical read boundary because they bypass table RLS.
 execute format('create view staff_location_scope.%I with (security_barrier=true) as select * from public.%I where private.staff_location_row_allowed(%L,to_jsonb(%I.*))',t,t,t,t);
 execute format('revoke all on staff_location_scope.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Audit snapshots retain old customer and booking details. Keep the complete
-- cross-location audit trail administrator-only; do not expose it as a back door.
create policy staff_location_audit_read on public.audit_logs as restrictive for select to authenticated
 using (not private.staff_location_scoped());
create view staff_location_scope.audit_logs with (security_barrier=true) as
 select * from public.audit_logs where not private.staff_location_scoped();
revoke all on staff_location_scope.audit_logs from public,anon,authenticated;
create policy staff_location_loyalty_read on public.loyalty_point_transactions as restrictive for select to authenticated
 using (not private.staff_location_scoped() or (source_type='staff_order' and exists(
 select 1 from public.staff_orders o where o.id=source_id and private.staff_location_order_allowed(o.session_id,o.arena_id))));
create view staff_location_scope.loyalty_point_transactions with (security_barrier=true) as
 select * from public.loyalty_point_transactions t where not private.staff_location_scoped() or
 (t.source_type='staff_order' and exists(select 1 from public.staff_orders o where o.id=t.source_id and private.staff_location_order_allowed(o.session_id,o.arena_id)));
revoke all on staff_location_scope.loyalty_point_transactions from public,anon,authenticated;

-- Base-table triggers also protect legacy SECURITY DEFINER mutation entry points,
-- including source and destination of a move and order/session relinking.
create function private.staff_location_guard_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.staff_location_scoped() then
 if tg_op<>'INSERT' and not private.staff_location_row_allowed(tg_table_name,to_jsonb(old)) then raise exception 'Location access denied.'; end if;
 -- A permitted booking must not be used to manufacture access to an unrelated
 -- customer by replacing its customer/participant/owner foreign key.
 if tg_op<>'DELETE' then
 if tg_table_name='staff_orders' then
 if new.customer_id is not null and not private.staff_location_profile_allowed(new.customer_id) then raise exception 'Customer location access denied.'; end if;
 end if;
 if tg_table_name='sessions' then
   if new.ticket_customer_id is not null and not private.staff_location_profile_allowed(new.ticket_customer_id) then raise exception 'Customer location access denied.'; end if;
   if new.owner_id is not null and new.owner_id is distinct from auth.uid() and not private.staff_location_profile_allowed(new.owner_id) then raise exception 'Customer location access denied.'; end if;
 end if;
 if tg_table_name='session_participants' then
 if new.profile_id is not null and new.profile_id is distinct from auth.uid() and not private.staff_location_profile_allowed(new.profile_id) then raise exception 'Customer location access denied.'; end if;
 end if;
 end if;
 if tg_op<>'DELETE' and not (tg_table_name='profiles' and tg_op='INSERT') and not private.staff_location_row_allowed(tg_table_name,to_jsonb(new)) then raise exception 'Location access denied.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create function private.staff_location_track_customer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.staff_location_scoped() then
 insert into private.staff_customer_locations select new.id,l.venue_key from public.staff_access_locations() l on conflict do nothing;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['sessions','staff_orders','staff_order_payments','profiles','session_participants','staff_session_games_played','session_participant_chapter_times','blocked_times','player_stat_overrides','profile_achievement_awards','session_invites','session_messages','session_waitlist','tournament_audit_log','tournament_editors','tournament_matches','tournament_pool_entries','tournament_pools','tournament_teams'] loop
 execute format('create trigger staff_location_guard_write before insert or update or delete on public.%I for each row execute function private.staff_location_guard_write()',t);
 end loop;
end $$;
create trigger staff_location_track_customer after insert on public.profiles for each row execute function private.staff_location_track_customer();

-- Apply the same scoped read projection to all existing definer business routines,
-- including legacy overloads and nested report scans. Authorization/identity helpers
-- must continue reading authoritative base rows (otherwise they recurse).
-- This is a migration-time rewrite, not runtime dynamic SQL or a caller-controlled path.
do $$ declare f record; t text; d text; original text; begin
 for f in select p.oid,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f' and p.prosecdef
 and p.prorettype<>'trigger'::regtype
 and p.proname !~ '^(staff_location_|staff_access_locations|staff_set_employee_locations|current_staff_|is_staff_|is_vrena_|staff_role_rank|can_manage_session_row|can_view_session_row|can_join_session_row|staff_kiosk_)'
 loop
 d:=pg_get_functiondef(f.oid); original:=d;
 foreach t in array array['sessions','staff_orders','staff_order_payments','profiles','session_participants','staff_session_games_played','session_participant_chapter_times','blocked_times','player_stat_overrides','profile_achievement_awards','session_invites','session_messages','session_waitlist','tournament_audit_log','tournament_editors','tournament_matches','tournament_pool_entries','tournament_pools','tournament_teams','audit_logs','loyalty_point_transactions'] loop
 d:=regexp_replace(d,'\m(from|join)([[:space:]]+)(public\.)?'||t||'\M','\1\2staff_location_scope.'||t,'gi');
 end loop;
 if d<>original then execute d; end if;
 end loop;
end $$;

-- Session ownership/editor shortcuts must not override a staff venue restriction.
do $$ declare d text; begin
 select pg_get_functiondef('private.can_manage_session_row(uuid)'::regprocedure) into d;
 d:=replace(d,'select coalesce(public.current_staff_role_rank(), 0) >= 50',
 'select (not private.staff_location_scoped() or private.staff_location_session_allowed(p_session_id)) and (coalesce(public.current_staff_role_rank(), 0) >= 50');
 if d not like '%private.staff_location_scoped()%' then raise exception 'Unexpected session authorization definition.'; end if;
 d:=regexp_replace(d,';[[:space:]]*\$function\$',');' || chr(10) || '$function$');
 execute d;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'staff_location_%' loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated,service_role',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
