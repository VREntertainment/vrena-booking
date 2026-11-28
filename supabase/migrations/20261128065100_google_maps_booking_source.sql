alter table public.sessions drop constraint sessions_booking_source_check;
alter table public.sessions add constraint sessions_booking_source_check
  check (booking_source in ('walk_in','zalo','whatsapp','phone','website','social_media','google_maps','other'));

alter table public.staff_orders drop constraint staff_orders_booking_source_check;
alter table public.staff_orders add constraint staff_orders_booking_source_check
  check (booking_source in ('walk_in','zalo','whatsapp','phone','website','social_media','google_maps','other'));

-- Preserve all other validation and capacity checks in the current staff booking functions.
do $migration$
declare
  signature regprocedure;
  definition text;
  updated text;
begin
  foreach signature in array array[
    'private.staff_create_booking(jsonb,text)'::regprocedure,
    'private.staff_update_calendar_booking(uuid,jsonb)'::regprocedure,
    'private.staff_update_booking_details(uuid,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    updated := replace(definition,
      $old$'walk_in','zalo','whatsapp','phone','website','social_media','other'$old$,
      $new$'walk_in','zalo','whatsapp','phone','website','social_media','google_maps','other'$new$);
    if updated = definition then
      raise exception 'Booking source validation not found in %', signature;
    end if;
    execute updated;
  end loop;
end;
$migration$;
