-- These are customer contact restrictions, not staff login restrictions.
create function private.reservation_contact_is_official(p_email text,p_phone text)
returns boolean language sql immutable set search_path='' as $$
 select lower(btrim(coalesce(p_email,''))) ~ '@vre-vietnam[.]com$'
 or regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') = any(array[
 '0981152315','84981152315','0084981152315','0981157039','84981157039','0084981157039']);
$$;
revoke all on function private.reservation_contact_is_official(text,text) from public,anon,authenticated;

create function private.reject_official_reservation_contacts()
returns trigger language plpgsql security definer set search_path='' as $$
declare contact_id uuid; contact_email text; contact_phone text;
begin
 if tg_table_name='staff_orders' then
  contact_email:=new.customer_email; contact_phone:=new.customer_phone; contact_id:=new.customer_id;
 else
  contact_id:=new.ticket_customer_id;
  -- Staff owners identify operators, not customers. Keep staff login working.
  if contact_id is null and coalesce(public.current_staff_role_rank(),0)=0 then contact_id:=new.owner_id; end if;
 end if;
 if private.reservation_contact_is_official(contact_email,contact_phone) then
  raise exception 'Use the customer’s personal email and phone number. VRena company emails and official phone numbers cannot be used for reservations.';
 end if;
 if contact_id is not null and exists(
  select 1 from public.profiles p left join auth.users u on u.id=p.id
  where p.id=contact_id and (private.reservation_contact_is_official(p.email,p.phone)
    or private.reservation_contact_is_official(u.email,null))
 ) then
  raise exception 'Use the customer’s personal email and phone number. VRena company emails and official phone numbers cannot be used for reservations.';
 end if;
 return new;
end $$;
revoke all on function private.reject_official_reservation_contacts() from public,anon,authenticated;
create trigger staff_orders_reject_official_contacts before insert or update of customer_id,customer_email,customer_phone on public.staff_orders
for each row execute function private.reject_official_reservation_contacts();
create trigger sessions_reject_official_contacts before insert or update of ticket_customer_id,owner_id on public.sessions
for each row execute function private.reject_official_reservation_contacts();
