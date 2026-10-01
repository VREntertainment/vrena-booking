-- New staff reservations use a neutral title. Existing records are displayed without
-- their generated suffix in the calendar/editor; custom names are never rewritten.
begin;
do $$
declare fn record; definition text; changed int := 0;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('create_staff_reserved_order','create_staff_reserved_order_v2','create_staff_reserved_order_v3'))
       or (n.nspname='public' and p.proname='create_staff_order')
  loop
    definition := pg_get_functiondef(fn.oid);
    if strpos(definition, $old$'Staff booking - ' || v_game.name$old$) > 0 then
      execute replace(definition, $old$'Staff booking - ' || v_game.name$old$, $new$'Staff booking'$new$);
      changed := changed + 1;
    end if;
  end loop;
  if changed = 0 then raise exception 'Expected staff booking name generation was not found.'; end if;
end $$;
notify pgrst, 'reload schema';
commit;
