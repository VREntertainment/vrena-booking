begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);
insert into public.staff_games(slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds,available_arena_ids,audience,active) values
('laser-tag','Laser Tag','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('revolta','Revolta','shooting',45,8,1,array['arena-1','arena-2'],array['fun'],true),
('city-z','City Z','other',45,6,1,array['arena-1','arena-2'],array['teamwork'],true),
('station-zarya','Station Zarya','other',45,6,1,array['arena-1','arena-2'],array['teamwork'],true)
on conflict(slug) do nothing;
commit;
