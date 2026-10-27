begin;

-- Service-role API handlers must explicitly check the caller's scope before using
-- admin capabilities. Resolve kiosk operators from the authenticated request.
create function public.staff_customer_profile_allowed(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_staff_role_rank(), 0) >= 50
    and exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and p.deleted_at is null
        and coalesce(lower(trim(p.role)), '') in ('', 'player')
        and not exists (select 1 from public.staff_employee_profiles e
          where e.profile_id = p.id and e.deleted_at is null)
        and (public.current_staff_role_rank() >= 100
          or private.staff_location_profile_allowed(p.id))
    )
$$;
revoke all on function public.staff_customer_profile_allowed(uuid) from public, anon;
grant execute on function public.staff_customer_profile_allowed(uuid) to authenticated;

-- Only the trusted API may attach a newly created customer. The API supplies the
-- locations obtained from staff_access_locations using the caller's JWT/operator.
-- Ordinary authenticated callers cannot manufacture access to another customer.
create function public.service_register_staff_customer_locations(p_profile_id uuid, p_venue_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service access required.';
  end if;
  if p_venue_keys is null or cardinality(p_venue_keys) = 0
    or exists(select 1 from unnest(p_venue_keys) k where k is null or not exists(
      select 1 from public.staff_locations l where l.venue_key = k and l.active)) then
    raise exception 'Valid customer locations required.';
  end if;
  perform 1 from public.profiles p where p.id = p_profile_id and p.deleted_at is null
    and coalesce(lower(trim(p.role)), '') in ('', 'player')
    and not exists(select 1 from public.staff_employee_profiles e where e.profile_id = p.id and e.deleted_at is null)
    for update;
  if not found then raise exception 'Customer profile required.'; end if;
  insert into private.staff_customer_locations(profile_id, venue_key)
    select p_profile_id, k from (select distinct unnest(p_venue_keys) k) locations
    on conflict do nothing;
end
$$;
revoke all on function public.service_register_staff_customer_locations(uuid,text[]) from public, anon, authenticated;
grant execute on function public.service_register_staff_customer_locations(uuid,text[]) to service_role;
notify pgrst, 'reload schema';
commit;
