begin;
-- Staff and trusted imports may explicitly supply a planned game. Online ticket
-- creation supplies no confirmed game, so service defaults still remain empty.
create or replace function private.set_booking_metadata()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.booking_category:=coalesce(new.booking_category,case when new.ticket_type='birthday' then 'birthday' when new.ticket_type='corporate' then 'event' else 'standard' end);
  if new.booking_type='ticket' and new.confirmed_game_id is distinct from 'sim-racing' then
   if (coalesce(public.current_staff_role_rank(),0)>=50 or coalesce(auth.role(),'')='service_role')
    and (new.confirmed_game_id is not null or new.ticket_reference like 'POS-%') then
    new.game_selection_explicit:=new.confirmed_game_id is not null;
   else
    -- Current online tickets reserve time; the customer does not choose a game.
    new.game_options:=array[]::text[]; new.confirmed_game_id:=null; new.game_votes:='{}'::jsonb;
    new.game_selection_explicit:=false; new.booking_source:='website';
   end if;
  end if;
 elsif coalesce(auth.role(),'')<>'service_role' and coalesce(public.current_staff_role_rank(),0)<50
  and (new.booking_category is distinct from old.booking_category or new.booking_source is distinct from old.booking_source or new.game_selection_explicit is distinct from old.game_selection_explicit)
 then raise exception 'Booking metadata can only be changed by staff.';
 end if;
 return new;
end $$;
commit;
