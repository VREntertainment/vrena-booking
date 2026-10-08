begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.staff_games (slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds,image_url,available_arena_ids,active,description)
values
  ('birthday-party','Birthday Party','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('portal-zombie','Portal Zombie','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('arcade-2-0','Arcade 2.0','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('party-games','Party Games','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('portal-mafia','Portal Mafia','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('orc-kings-arena','Orc King''s Arena','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.'),
  ('vr-arena-strike','VR Arena Strike','other',20,6,1,'/games/vrena-shared.svg',array['arena-1','arena-2'],true,'Available at Ha Do Centrosa: up to 4 players per arena; Thao Dien: up to 6 players per arena.')
on conflict (slug) do nothing;

do $migration$
declare r record; definition text; updated text; changed integer := 0;
begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('create_staff_reserved_order','create_staff_reserved_order_v2','create_staff_reserved_order_v3','staff_update_calendar_booking'))
       or (n.nspname='public' and p.proname='create_staff_order')
  loop
    definition := pg_get_functiondef(r.signature);
    updated := replace(definition, $old$('revolta', 'city-z', 'station-zarya')$old$, $new$('revolta', 'city-z', 'station-zarya', 'birthday-party', 'portal-zombie', 'arcade-2-0', 'party-games', 'portal-mafia', 'orc-kings-arena', 'vr-arena-strike')$new$);
    updated := replace(updated, $old$('revolta','city-z','station-zarya')$old$, $new$('revolta', 'city-z', 'station-zarya', 'birthday-party', 'portal-zombie', 'arcade-2-0', 'party-games', 'portal-mafia', 'orc-kings-arena', 'vr-arena-strike')$new$);
    if updated = definition then raise exception 'Expected venue allowlist absent in %', r.signature; end if;
    execute updated;
    changed := changed + 1;
  end loop;
  if changed <> 5 then raise exception 'Expected 5 booking paths, found %',changed; end if;
end;
$migration$;
commit;
