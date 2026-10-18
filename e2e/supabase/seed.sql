begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);
insert into public.staff_games(slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds,available_arena_ids,audience,active) values
('arcade-2-0','Arcade 2.0','shooting',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('birthday-party','Birthday Party','other',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('party-games','Party Games','other',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('portal-mafia','Portal Mafia','shooting',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('portal-zombie','Portal Zombie','other',20,6,1,array['arena-1','arena-2'],array['teamwork'],true),
('orc-kings-arena','Orc King''s Arena','shooting',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('vr-arena-strike','VR Arena Strike','shooting',20,6,1,array['arena-1','arena-2'],array['fun'],true),
('laser-tag','Laser Tag','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('mini-block-towers','Mini Block Towers','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('office-war','Office War','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('paintball','Paintball','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('snow-battle','Snow Battle','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('castle-unspunnen','Castle Unspunnen','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('wild-west','Wild West','shooting',20,4,1,array['arena-1','arena-2'],array['fun'],true),
('arc-of-the-covenant','Arc of the Covenant','escape',40,4,1,array['arena-1','arena-2'],array['quest'],true),
('joller-house','Joller House','escape',40,4,1,array['arena-1','arena-2'],array['quest'],true),
('revolta','Revolta','shooting',45,8,1,array['arena-1','arena-2'],array['fun'],true),
('city-z','City Z','other',45,6,1,array['arena-1','arena-2'],array['teamwork'],true),
('station-zarya','Station Zarya','other',45,6,1,array['arena-1','arena-2'],array['teamwork'],true)
on conflict(slug) do nothing;
commit;
