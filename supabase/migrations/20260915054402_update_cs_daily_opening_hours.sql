-- Update only CS hours; retain permissions, pricing and soft-opening request behavior.
do $hours$
declare
  patch record;
  original text;
  updated text;
begin
  for patch in select * from (values
    ('public.create_cafe_ticket_booking_request(text,date,time,integer,integer,integer,text[],text,text,text)',
     'v_start_minutes < 16 * 60 or v_end_minutes > 22 * 60',
     'v_start_minutes < 15 * 60 + 30 or v_end_minutes > 23 * 60'),
    ('public.create_staff_order(uuid,text,text,text,uuid,date,time,integer,text,uuid,text,text,text,boolean,text,text,text,text,text,text,numeric)',
     'v_booking_minutes < (case when v_venue_key = ''cafe-des-stagiaires'' then 16 else 9 end) * 60 or v_end_minutes > 22 * 60',
     'v_booking_minutes < (case when v_venue_key = ''cafe-des-stagiaires'' then 930 else 540 end) or v_end_minutes > (case when v_venue_key = ''cafe-des-stagiaires'' then 1380 else 1320 end)'),
    ('private.staff_update_calendar_booking(uuid,jsonb)',
     'v_start < (case when v_venue=''cafe-des-stagiaires'' then 960 else 540 end) or v_end>1320',
     'v_start < (case when v_venue=''cafe-des-stagiaires'' then 930 else 540 end) or v_end > (case when v_venue=''cafe-des-stagiaires'' then 1380 else 1320 end)')
  ) as patches(signature, old_guard, new_guard)
  loop
    original := pg_get_functiondef(patch.signature::regprocedure);
    if strpos(original, patch.old_guard) = 0 then
      raise exception 'Expected opening-hours guard missing in %', patch.signature;
    end if;
    updated := replace(original, patch.old_guard, patch.new_guard);
    execute updated;
  end loop;
end;
$hours$;

