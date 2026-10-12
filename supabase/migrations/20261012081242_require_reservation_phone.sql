begin;
create function private.require_online_reservation_phone() returns trigger
language plpgsql security definer set search_path='' as $$
declare phone text;
begin
  -- Staff operations and service integrations retain their separate policies.
  -- Customer-created sessions use direct INSERT, not the ticket RPCs.
  if auth.uid() is not null and auth.role()='authenticated'
    and coalesce(public.current_staff_role_rank(),0)=0 then
    select p.phone into phone from public.profiles p where p.id=auth.uid() and p.deleted_at is null;
    if length(regexp_replace(coalesce(phone,''),'[^0-9]','','g')) not between 8 and 15 then
      raise exception 'Add a valid phone number to your profile before booking.';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.require_online_reservation_phone() from public,anon,authenticated;
create trigger sessions_require_online_phone before insert on public.sessions
for each row execute function private.require_online_reservation_phone();
commit;
