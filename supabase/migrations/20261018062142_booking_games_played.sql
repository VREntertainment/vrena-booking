-- Games played are distinct from a booking's planned game, price and reserved time.
create table public.staff_game_play_options (
 id text primary key, parent_slug text not null, title text not null,
 kind text not null check (kind in ('mini-game','mode','map'))
);
alter table public.staff_game_play_options enable row level security;
create policy staff_read_play_options on public.staff_game_play_options for select to authenticated using ((select public.current_staff_role_rank()) >= 50);
revoke all on public.staff_game_play_options from public,anon,authenticated;
grant select on public.staff_game_play_options to authenticated;
revoke all on public.staff_game_play_options from anon;
insert into public.staff_game_play_options(id,parent_slug,title,kind) values
('orc-kings-arena:maps:imperial-cruiser','orc-kings-arena','Imperial Cruiser','map'),
('orc-kings-arena:maps:battle-for-the-asteroid','orc-kings-arena','Battle for the Asteroid','map'),
('orc-kings-arena:maps:toxic-city','orc-kings-arena','Toxic City','map'),
('orc-kings-arena:maps:ancient-mine','orc-kings-arena','Ancient Mine','map'),
('orc-kings-arena:maps:graq-toul-warship','orc-kings-arena','Graq’Toul Warship','map'),
('orc-kings-arena:maps:arena-of-the-orc-king','orc-kings-arena','Arena of the Orc King','map'),
('party-games:games:kill-the-mole','party-games','Kill the Mole!','mini-game'),
('party-games:games:catching-animals','party-games','Catching Animals','mini-game'),
('party-games:games:snowballs','party-games','Snowballs','mini-game'),
('party-games:games:car-wash','party-games','Car Wash','mini-game'),
('party-games:games:space-invaders','party-games','Space Invaders','mini-game'),
('birthday-party:games:balloon-blast','birthday-party','Balloon Blast','mini-game'),
('birthday-party:games:candle-hunt','birthday-party','Candle Hunt','mini-game'),
('birthday-party:games:pinatas','birthday-party','Piñatas','mini-game'),
('arcade-2-0:modes:deathmatch','arcade-2-0','Deathmatch','mode'),
('arcade-2-0:modes:team-deathmatch','arcade-2-0','Team Deathmatch','mode'),
('arcade-2-0:modes:gun-game','arcade-2-0','Gun Game','mode'),
('arcade-2-0:modes:tournament','arcade-2-0','Tournament','mode'),
('arcade-2-0:maps:cyberpunk','arcade-2-0','CyberPunk','map'),
('arcade-2-0:maps:egypt','arcade-2-0','Egypt','map'),
('arcade-2-0:maps:fridge','arcade-2-0','Fridge','map'),
('arcade-2-0:maps:house','arcade-2-0','House','map'),
('arcade-2-0:maps:medieval','arcade-2-0','Medieval','map'),
('arcade-2-0:maps:pirates','arcade-2-0','Pirates','map'),
('portal-mafia:modes:deathmatch','portal-mafia','Deathmatch','mode'),
('portal-mafia:modes:team-deathmatch','portal-mafia','Team Deathmatch','mode'),
('portal-mafia:maps:street-city','portal-mafia','Street (City)','map'),
('portal-mafia:maps:casino','portal-mafia','Casino','map'),
('portal-zombie:modes:survival','portal-zombie','Survival','mode'),
('portal-zombie:maps:mansion','portal-zombie','Mansion','map'),
('vr-arena-strike:modes:deathmatch','vr-arena-strike','Deathmatch','mode'),
('vr-arena-strike:modes:team-deathmatch','vr-arena-strike','Team Deathmatch','mode'),
('vr-arena-strike:modes:gun-game','vr-arena-strike','Gun Game','mode'),
('vr-arena-strike:modes:tournament','vr-arena-strike','Tournament','mode'),
('vr-arena-strike:maps:hangar-angar','vr-arena-strike','Hangar (Angar)','map'),
('vr-arena-strike:maps:battlefield','vr-arena-strike','Battlefield','map'),
('vr-arena-strike:maps:city','vr-arena-strike','City','map'),
('vr-arena-strike:maps:metro','vr-arena-strike','Metro','map'),
('vr-arena-strike:maps:construction','vr-arena-strike','Construction','map'),
('vr-arena-strike:maps:office','vr-arena-strike','Office','map'),
('vr-arena-strike:maps:jungle','vr-arena-strike','Jungle','map'),
('laser-limbo:modes:team-deathmatch','laser-limbo','Team Deathmatch','mode'),
('laser-limbo:modes:team-elimination','laser-limbo','Team Elimination','mode'),
('laser-limbo:modes:domination','laser-limbo','Domination','mode'),
('laser-limbo:modes:drone-hunt','laser-limbo','Drone Hunt','mode'),
('laser-limbo:modes:drone-waves','laser-limbo','Drone Waves','mode'),
('laser-limbo:modes:saber-fight','laser-limbo','Saber Fight','mode'),
('laser-limbo:modes:coin-clash','laser-limbo','Coin Clash','mode'),
('laser-limbo:modes:puzzle-battle','laser-limbo','Puzzle Battle','mode'),
('laser-limbo:modes:pop-n-stop','laser-limbo','Pop’N’Stop','mode'),
('spatial-ops:modes:co-op-survival','spatial-ops','Co-op Survival','mode'),
('spatial-ops:modes:free-for-all','spatial-ops','Free For All','mode'),
('spatial-ops:modes:team-deathmatch','spatial-ops','Team Deathmatch','mode'),
('spatial-ops:modes:capture-the-flag','spatial-ops','Capture the Flag','mode'),
('spatial-ops:modes:domination','spatial-ops','Domination','mode');

create view public.staff_playable_games with (security_invoker=true) as
select slug as id, slug as parent_slug, name as title, 'game'::text as kind from public.staff_games where active
union all
select slug,slug,title,'game' from (values ('laser-limbo','Laser Limbo'),('spatial-ops','Spatial Ops')) e(slug,title)
where not exists (select 1 from public.staff_games g where g.slug=e.slug)
union all
select o.id,o.parent_slug,o.title,o.kind from public.staff_game_play_options o
where o.parent_slug in ('laser-limbo','spatial-ops') or exists(select 1 from public.staff_games g where g.slug=o.parent_slug and g.active);
revoke all on public.staff_playable_games from public,anon;
grant select on public.staff_playable_games to authenticated;

create table public.staff_session_games_played (
 session_id uuid primary key references public.sessions(id) on delete cascade,
 game_ids text[] not null default '{}',
 confirmed_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default clock_timestamp(),
 check (cardinality(game_ids) <= 200)
);
alter table public.staff_session_games_played enable row level security;
create policy staff_read_games_played on public.staff_session_games_played for select to authenticated using ((select public.current_staff_role_rank()) >= 50);
revoke all on public.staff_session_games_played from public,anon,authenticated;
grant select on public.staff_session_games_played to authenticated;
revoke all on public.staff_session_games_played from anon;

create function private.staff_confirm_games_played(p_session_id uuid,p_game_ids text[],p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.staff_session_games_played%rowtype; v_ids text[]; v_updated timestamptz;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if p_game_ids is null or cardinality(p_game_ids)>200 then raise exception 'Choose valid games.'; end if;
 perform 1 from public.sessions where id=p_session_id and deleted_at is null for update;
 if not found then raise exception 'Booking not found.'; end if;
 select * into v_existing from public.staff_session_games_played where session_id=p_session_id;
 if v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'Games played changed. Reload before saving.'; end if;
 if exists(select 1 from unnest(p_game_ids) i where i is null or not exists(select 1 from public.staff_playable_games g where g.id=i)) then raise exception 'Choose available games, mini-games or modes.'; end if;
 select coalesce(array_agg(distinct i order by i),'{}') into v_ids from unnest(p_game_ids) i;
 insert into public.staff_session_games_played(session_id,game_ids,confirmed_by,updated_at)
 values(p_session_id,v_ids,auth.uid(),clock_timestamp())
 on conflict(session_id) do update set game_ids=excluded.game_ids,confirmed_by=excluded.confirmed_by,updated_at=excluded.updated_at
 returning updated_at into v_updated;
 return jsonb_build_object('game_ids',v_ids,'updated_at',v_updated);
end; $$;
revoke all on function private.staff_confirm_games_played(uuid,text[],timestamptz) from public,anon;
grant execute on function private.staff_confirm_games_played(uuid,text[],timestamptz) to authenticated;
create function public.staff_confirm_games_played(p_session_id uuid,p_game_ids text[],p_expected_updated_at timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.staff_confirm_games_played(p_session_id,p_game_ids,p_expected_updated_at); $$;
revoke all on function public.staff_confirm_games_played(uuid,text[],timestamptz) from public,anon;
grant execute on function public.staff_confirm_games_played(uuid,text[],timestamptz) to authenticated;
notify pgrst, 'reload schema';
