begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- Use the existing arena-session defaults, as requested. Keep existing edits.
insert into public.staff_games(slug,name,game_type,duration_minutes,max_players_per_arena,number_of_rounds,image_url,available_arena_ids,audience,active)
values
 ('laser-limbo','Laser Limbo','shooting',20,4,1,'/games/posters/laser-limbo.webp',array['arena-1','arena-2'],array['fun','teamwork'],true),
 ('spatial-ops','Spatial Ops','shooting',20,4,1,'/games/posters/spatial-ops.webp',array['arena-1','arena-2'],array['teamwork','competitive'],true)
on conflict(slug) do nothing;
commit;
