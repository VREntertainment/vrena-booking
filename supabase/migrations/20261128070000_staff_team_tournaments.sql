begin;

create table private.staff_team_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  venue_key text not null references public.staff_locations(venue_key),
  game_slug text not null,
  format text not null check (format in ('single_elimination','round_robin')),
  tie_break text not null check (tie_break in ('difference','scored')),
  version integer not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index on private.staff_team_tournaments(venue_key, created_at desc);

create table private.staff_tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references private.staff_team_tournaments(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  seed integer not null check (seed between 1 and 16),
  checked_in boolean not null default false,
  reserve boolean not null default false,
  unique (tournament_id, seed) deferrable initially immediate,
  unique (tournament_id, id)
);
create unique index on private.staff_tournament_teams(tournament_id, lower(name));

create table private.staff_tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references private.staff_team_tournaments(id) on delete cascade,
  number integer not null,
  round integer not null,
  team_a uuid,
  team_b uuid,
  feed_a integer,
  feed_b integer,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed')),
  match_date date,
  start_time time,
  arena_number integer,
  duration integer,
  score_a integer check (score_a between 0 and 999),
  score_b integer check (score_b between 0 and 999),
  winner uuid,
  outcome text check (outcome in ('score','forfeit','no_show','bye')),
  review boolean not null default false,
  started_at timestamptz,
  unique (tournament_id, number),
  foreign key (tournament_id, team_a) references private.staff_tournament_teams(tournament_id,id),
  foreign key (tournament_id, team_b) references private.staff_tournament_teams(tournament_id,id),
  foreign key (tournament_id, winner) references private.staff_tournament_teams(tournament_id,id),
  foreign key (tournament_id, feed_a) references private.staff_tournament_matches(tournament_id,number),
  foreign key (tournament_id, feed_b) references private.staff_tournament_matches(tournament_id,number),
  check (num_nonnulls(match_date,start_time,arena_number,duration) in (0,4)),
  check (team_a is null or team_b is null or team_a <> team_b)
);

create table private.staff_tournament_result_audit (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references private.staff_team_tournaments(id) on delete cascade,
  match_number integer not null,
  action text not null check (action in ('correction','reset')),
  reason text not null check (length(btrim(reason)) between 3 and 300),
  actor_id uuid not null,
  before jsonb not null,
  after jsonb not null,
  changed_at timestamptz not null default now(),
  foreign key(tournament_id,match_number) references private.staff_tournament_matches(tournament_id,number)
);
create index on private.staff_tournament_result_audit(tournament_id, changed_at desc);

alter table private.staff_team_tournaments enable row level security;
alter table private.staff_tournament_teams enable row level security;
alter table private.staff_tournament_matches enable row level security;
alter table private.staff_tournament_result_audit enable row level security;
revoke all on private.staff_team_tournaments, private.staff_tournament_teams,
  private.staff_tournament_matches, private.staff_tournament_result_audit from public, anon, authenticated;

-- This third ownership type uses the same exclusion constraint as customer bookings.
alter table private.arena_reservations
  add column tournament_match_id uuid unique references private.staff_tournament_matches(id) on delete cascade,
  drop constraint arena_reservations_check,
  add constraint arena_reservations_one_owner check (num_nonnulls(session_id,blocked_time_id,tournament_match_id)=1);

create function private.staff_tournament_reconcile(p_tournament_id uuid) returns void
language plpgsql set search_path = '' as $$
declare m record; a uuid; b uuid;
begin
  for m in select * from private.staff_tournament_matches
    where tournament_id=p_tournament_id and feed_a is not null order by number
  loop
    select winner into a from private.staff_tournament_matches
      where tournament_id=p_tournament_id and number=m.feed_a and status='completed' and not review;
    select winner into b from private.staff_tournament_matches
      where tournament_id=p_tournament_id and number=m.feed_b and status='completed' and not review;
    if m.status='scheduled' then
      update private.staff_tournament_matches set team_a=a,team_b=b,review=false where id=m.id;
    else
      update private.staff_tournament_matches set review=(team_a is distinct from a or team_b is distinct from b) where id=m.id;
    end if;
  end loop;
end $$;

create function private.staff_tournament_open_byes(p_id uuid) returns setof integer
language sql stable set search_path = '' as $$
  with recursive branch(opening, number, started_at) as (
    select number, number, started_at from private.staff_tournament_matches
      where tournament_id=p_id and outcome='bye'
    union all
    select b.opening, m.number, m.started_at from branch b
      join private.staff_tournament_matches m on m.tournament_id=p_id and b.number in (m.feed_a,m.feed_b)
  )
  select opening from branch group by opening having count(started_at)=0 order by opening;
$$;

create function private.staff_tournament_place_team(p_id uuid,p_match integer,p_side text,p_team uuid) returns void
language plpgsql set search_path = '' as $$
declare src private.staff_tournament_matches; dst private.staff_tournament_matches; displaced uuid;
begin
  if p_side is null or p_side not in ('a','b') then raise exception 'Choose a bracket slot.'; end if;
  select * into dst from private.staff_tournament_matches where tournament_id=p_id and round=1 and number=p_match;
  select * into src from private.staff_tournament_matches where tournament_id=p_id and round=1 and p_team in(team_a,team_b);
  if dst.id is null or src.id is null then raise exception 'Choose an opening match and an existing team.'; end if;
  displaced:=case when p_side='a' then dst.team_a else dst.team_b end;
  if displaced is null then raise exception 'Choose an occupied bracket slot.'; end if;
  if displaced=p_team then return; end if;
  update private.staff_tournament_matches
    set team_a=case when team_a=displaced then p_team when team_a=p_team then displaced else team_a end,
        team_b=case when team_b=displaced then p_team when team_b=p_team then displaced else team_b end,
        winner=case when winner=displaced then p_team when winner=p_team then displaced else winner end
    where id in (src.id,dst.id);
end $$;

create function private.staff_tournament_generate(p_tournament_id uuid,p_format text) returns void
language plpgsql set search_path = '' as $$
declare ids uuid[]; seeds integer[]:=array[1,2]; n integer; size integer:=2; i integer; j integer;
  match_no integer:=0; round_no integer:=1; prior integer:=0; count_in_round integer; a uuid; b uuid;
begin
  select array_agg(id order by seed) into ids from private.staff_tournament_teams where tournament_id=p_tournament_id;
  n:=coalesce(cardinality(ids),0);
  if n<2 or n>16 then raise exception 'Add between 2 and 16 teams.'; end if;
  if exists(select 1 from private.staff_tournament_matches where tournament_id=p_tournament_id) then
    raise exception 'Matches have already been generated.';
  end if;
  if p_format='single_elimination' then
    while size<n loop
      size:=size*2;
      select array_agg(v order by ordinal,side) into seeds
      from unnest(seeds) with ordinality s(seed,ordinal)
      cross join lateral (values (s.seed,1),(size+1-s.seed,2)) z(v,side);
    end loop;
    for i in 1..size/2 loop
      a:=ids[seeds[i*2-1]]; b:=ids[seeds[i*2]];
      match_no:=match_no+1;
      insert into private.staff_tournament_matches(tournament_id,number,round,team_a,team_b,status,winner,outcome)
      values(p_tournament_id,match_no,1,a,b,
        case when a is null or b is null then 'completed' else 'scheduled' end,
        case when a is null or b is null then coalesce(a,b) end,
        case when a is null or b is null then 'bye' end);
    end loop;
    count_in_round:=size/2;
    while count_in_round>1 loop
      round_no:=round_no+1;
      for i in 1..count_in_round/2 loop
        match_no:=match_no+1;
        insert into private.staff_tournament_matches(tournament_id,number,round,feed_a,feed_b)
          values(p_tournament_id,match_no,round_no,prior+2*i-1,prior+2*i);
      end loop;
      prior:=prior+count_in_round;
      count_in_round:=count_in_round/2;
    end loop;
    perform private.staff_tournament_reconcile(p_tournament_id);
  else
    if n%2=1 then ids:=array_append(ids,null::uuid); n:=n+1; end if;
    for i in 1..n-1 loop
      for j in 1..n/2 loop
        a:=ids[j]; b:=ids[n+1-j];
        if a is null or b is null then continue; end if;
        match_no:=match_no+1;
        insert into private.staff_tournament_matches(tournament_id,number,round,team_a,team_b)
          values(p_tournament_id,match_no,i,a,b);
      end loop;
      ids:=array[ids[1],ids[n]]||ids[2:n-1];
    end loop;
  end if;
end $$;

create function private.staff_tournament_schedule(p_match private.staff_tournament_matches,p_venue text,p_game text,p_payload jsonb)
returns void language plpgsql set search_path = '' as $$
declare day date:=(p_payload->>'match_date')::date; starts time:=(p_payload->>'start_time')::time;
  minutes integer:=(p_payload->>'duration')::integer; arena integer:=(p_payload->>'arena_number')::integer;
  arena_key text; slot_range tsrange;
begin
  if day is null or starts is null or minutes is null or minutes not between 5 and 240
    or arena is null or arena not between 1 and (case when p_venue='cafe-des-stagiaires' then 1 else 2 end)
    or extract(second from starts)<>0 then raise exception 'Choose a valid date, time, arena and duration.'; end if;
  if (p_venue='ha-do-centrosa' and (starts<time '09:00' or starts>time '21:30' or day+starts+make_interval(mins=>minutes)>day+time '22:00'))
    or (p_venue='cafe-des-stagiaires' and (starts<time '15:30' or day+starts+make_interval(mins=>minutes)>day+time '23:00')) then
    raise exception 'The match is outside venue opening hours.';
  end if;
  arena_key:=case when p_venue='cafe-des-stagiaires' then 'cafe:arena-1' else 'arena-'||arena::text end;
  if not exists(select 1 from public.staff_games g where g.slug=p_game and g.active
    and private.booking_game_available_at_venue(g.slug,p_venue)
    and (p_venue='cafe-des-stagiaires' or coalesce(cardinality(g.available_arena_ids),0)=0 or arena_key=any(g.available_arena_ids))) then
    raise exception 'This game is unavailable in the selected arena.';
  end if;

  slot_range:=tsrange(day+starts,day+starts+make_interval(mins=>minutes),'[)');
  if exists (
    select 1 from private.staff_tournament_matches m
    where m.tournament_id=p_match.tournament_id and m.id<>p_match.id and m.match_date is not null
      and (
        (m.number in (p_match.feed_a,p_match.feed_b) and m.match_date+m.start_time+make_interval(mins=>m.duration)>lower(slot_range))
        or (p_match.number in (m.feed_a,m.feed_b) and upper(slot_range)>m.match_date+m.start_time)
        or (tsrange(m.match_date+m.start_time,m.match_date+m.start_time+make_interval(mins=>m.duration),'[)') && slot_range
          and (m.team_a in (p_match.team_a,p_match.team_b) or m.team_b in (p_match.team_a,p_match.team_b)))
      )
  ) then raise exception 'This time overlaps a team match or does not leave enough time between bracket rounds.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('arena:'||p_venue||':'||day::text,0));
  delete from private.arena_reservations where tournament_match_id=p_match.id;
  begin
    insert into private.arena_reservations(tournament_match_id,venue_key,arena_number,during)
      values(p_match.id,p_venue,arena,slot_range);
  exception when exclusion_violation then
    raise exception using errcode='23P01',message='That arena is already booked. Choose another time or arena.';
  end;
  update private.staff_tournament_matches set match_date=day,start_time=starts,arena_number=arena,duration=minutes where id=p_match.id;
end $$;

create function public.staff_team_tournament_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<20 then raise exception 'Staff access required.'; end if;
  return jsonb_build_object(
    'tournaments',coalesce((select jsonb_agg(to_jsonb(t)-'created_by' order by t.created_at desc)
      from private.staff_team_tournaments t where private.staff_location_allowed(t.venue_key)),'[]'::jsonb),
    'venues',coalesce((select jsonb_agg(to_jsonb(v) order by v.name)
      from public.staff_access_locations() v where v.venue_key in ('ha-do-centrosa','cafe-des-stagiaires')),'[]'::jsonb),
    'games',coalesce((select jsonb_agg(jsonb_build_object('slug',g.slug,'name',g.name,'arena_ids',g.available_arena_ids,
      'venue_keys',(select jsonb_agg(l.venue_key order by l.venue_key) from public.staff_access_locations() l
        where l.venue_key in ('ha-do-centrosa','cafe-des-stagiaires') and private.booking_game_available_at_venue(g.slug,l.venue_key))) order by g.name)
      from public.staff_games g where g.active and g.slug<>'sim-racing'),'[]'::jsonb)
  );
end $$;

create function public.staff_team_tournament_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t private.staff_team_tournaments;
begin
  if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<20 then raise exception 'Staff access required.'; end if;
  select * into t from private.staff_team_tournaments where id=p_id and private.staff_location_allowed(venue_key);
  if not found then raise exception 'Tournament not found.'; end if;
  return jsonb_build_object(
    'tournament',to_jsonb(t)-'created_by',
    'open_byes',coalesce((select jsonb_agg(n) from private.staff_tournament_open_byes(t.id) n),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(to_jsonb(a)-'tournament_id' order by a.seed)
      from private.staff_tournament_teams a where a.tournament_id=t.id),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(to_jsonb(m)-'tournament_id'-'id' order by m.number)
      from private.staff_tournament_matches m where m.tournament_id=t.id),'[]'::jsonb),
    'audit',case when public.current_staff_role_rank()>=80 then coalesce((
      select jsonb_agg((to_jsonb(a)-'actor_id'-'tournament_id')||jsonb_build_object('actor',
        coalesce(nullif(p.full_name,''),'Staff '||left(a.actor_id::text,8))) order by a.changed_at desc,a.id)
      from private.staff_tournament_result_audit a left join public.profiles p on p.id=a.actor_id
      where a.tournament_id=t.id),'[]'::jsonb) else '[]'::jsonb end
  );
end $$;

create function public.staff_team_tournament_write(p_id uuid,p_version integer,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rank integer:=coalesce(public.current_staff_role_rank(),0);
  actor uuid:=public.current_staff_actor_profile_id();
  action text:=p_payload->>'action';
  t private.staff_team_tournaments;
  m private.staff_tournament_matches;
  team private.staff_tournament_teams;
  venue text:=p_payload->>'venue_key';
  game text:=p_payload->>'game_slug';
  rule text:=p_payload->>'tie_break';
  reason text:=btrim(coalesce(p_payload->>'reason',''));
  result_type text;
  a integer; b integer; requested_seed integer; replacement_seed integer;
  correction boolean;
  play_started boolean;
  selected_bye integer;
  last_match integer;
  last_round integer;
  team_a_id uuid;
  team_b_id uuid;
  before_result jsonb;
  after_result jsonb;
begin
  if auth.uid() is null or actor is null or rank<50 then raise exception 'Staff access required.'; end if;
  if action is null or action not in
    ('create','team','rename_team','pairing','remove_team','seed','rules','generate','schedule','unschedule','check_in','start','result','reset') then
    raise exception 'Unknown tournament action.';
  end if;
  if rank<80 and action not in ('check_in','start','result') then raise exception 'Manager access required.'; end if;

  if action='create' then
    if not exists(select 1 from public.staff_access_locations() l where l.venue_key=venue
      and l.venue_key in ('ha-do-centrosa','cafe-des-stagiaires')) then raise exception 'Venue access required.'; end if;
    if not exists(select 1 from public.staff_games g where g.slug=game and g.active and g.slug<>'sim-racing'
      and private.booking_game_available_at_venue(g.slug,venue)) then raise exception 'Choose a game available at this venue.'; end if;
    insert into private.staff_team_tournaments(name,venue_key,game_slug,format,tie_break,created_by)
      values(btrim(p_payload->>'name'),venue,game,p_payload->>'format',rule,actor) returning * into t;
    return public.staff_team_tournament_detail(t.id);
  end if;

  select * into t from private.staff_team_tournaments where id=p_id and private.staff_location_allowed(venue_key) for update;
  if not found then raise exception 'Tournament not found.'; end if;
  if t.version is distinct from p_version then raise exception 'The tournament changed. Refresh before retrying.'; end if;

  if action in ('remove_team','seed') and exists(select 1 from private.staff_tournament_matches where tournament_id=t.id) then
    raise exception 'Teams and seeds are locked after match generation.';
  end if;

  play_started:=exists(select 1 from private.staff_tournament_matches where tournament_id=t.id and started_at is not null);
  if action='team' then
    selected_bye:=(p_payload->>'bye_match')::integer;
    if selected_bye is not null and not exists(select 1 from private.staff_tournament_open_byes(t.id) n where n=selected_bye) then
      raise exception 'That opening slot is no longer available.';
    end if;
    select coalesce(max(number),0),coalesce(max(round),0) into last_match,last_round
      from private.staff_tournament_matches where tournament_id=t.id;
    if t.format='single_elimination' and last_match>0 and selected_bye is null then
      if exists(select 1 from private.staff_tournament_open_byes(t.id)) then raise exception 'Choose an opening opponent.'; end if;
      if not play_started and (p_payload->>'regenerate')::boolean is distinct from true then
        raise exception 'Confirm that you want to regenerate the draw and clear the existing match times.';
      end if;
    end if;
    insert into private.staff_tournament_teams(tournament_id,name,seed,reserve)
      select t.id,btrim(p_payload->>'name'),coalesce(max(seed),0)+1,
        t.format='single_elimination' and play_started and selected_bye is null
      from private.staff_tournament_teams where tournament_id=t.id
      returning * into team;
    if selected_bye is not null then
      update private.staff_tournament_matches
        set team_a=coalesce(team_a,team.id),team_b=case when team_a is null then team_b else team.id end,
            outcome=null,winner=null,status='scheduled'
        where tournament_id=t.id and number=selected_bye;
      perform private.staff_tournament_reconcile(t.id);
    elsif last_match>0 and t.format='round_robin' then
      insert into private.staff_tournament_matches(tournament_id,number,round,team_a,team_b)
        select t.id,last_match+row_number() over (order by seed),last_round+row_number() over (order by seed),id,team.id
        from private.staff_tournament_teams where tournament_id=t.id and id<>team.id;
    elsif last_match>0 and not play_started then
      delete from private.staff_tournament_matches where tournament_id=t.id;
      perform private.staff_tournament_generate(t.id,t.format);
    end if;
  elsif action='pairing' then
    if t.format<>'single_elimination' or play_started then raise exception 'The opening draw is locked.'; end if;
    select * into m from private.staff_tournament_matches
      where tournament_id=t.id and number=(p_payload->>'match_number')::integer and round=1;
    if not found then raise exception 'Choose an opening match.'; end if;
    team_a_id:=(p_payload->>'team_a')::uuid;
    team_b_id:=(p_payload->>'team_b')::uuid;
    if (team_a_id is null)<>(m.team_a is null) or (team_b_id is null)<>(m.team_b is null)
      or (team_a_id is not null and team_a_id=team_b_id) then raise exception 'Choose distinct teams for the occupied slots.'; end if;
    if team_a_id is not null then perform private.staff_tournament_place_team(t.id,m.number,'a',team_a_id); end if;
    if team_b_id is not null then perform private.staff_tournament_place_team(t.id,m.number,'b',team_b_id); end if;
    perform private.staff_tournament_reconcile(t.id);
  elsif action in ('remove_team','seed','check_in','rename_team') then
    select * into team from private.staff_tournament_teams where tournament_id=t.id and id=(p_payload->>'team_id')::uuid;
    if not found then raise exception 'Team not found.'; end if;
    if action='check_in' then
      update private.staff_tournament_teams set checked_in=(p_payload->>'checked_in')::boolean where id=team.id;
    elsif action='rename_team' then
      update private.staff_tournament_teams set name=btrim(p_payload->>'name') where id=team.id;
    elsif action='remove_team' then
      delete from private.staff_tournament_teams where id=team.id;
      update private.staff_tournament_teams set seed=seed-1 where tournament_id=t.id and seed>team.seed;
    else
      requested_seed:=(p_payload->>'seed')::integer;
      select seed into replacement_seed from private.staff_tournament_teams where tournament_id=t.id and seed=requested_seed;
      if not found then raise exception 'Choose an existing seed.'; end if;
      update private.staff_tournament_teams set seed=case when id=team.id then requested_seed else team.seed end
        where tournament_id=t.id and (id=team.id or seed=replacement_seed);
    end if;
  elsif action='rules' then
    if exists(select 1 from private.staff_tournament_matches where tournament_id=t.id and status<>'scheduled' and outcome is distinct from 'bye') then
      raise exception 'Standings rules are locked after the first match starts.';
    end if;
    update private.staff_team_tournaments set tie_break=rule where id=t.id;
  elsif action='generate' then
    perform private.staff_tournament_generate(t.id,t.format);
  else
    select * into m from private.staff_tournament_matches
      where tournament_id=t.id and number=(p_payload->>'match_number')::integer;
    if not found or m.outcome='bye' then raise exception 'Match not found or is a bye.'; end if;
    if action in ('schedule','unschedule') then
      if m.status<>'scheduled' then raise exception 'A started match cannot be rescheduled.'; end if;
      if action='schedule' then
        perform private.staff_tournament_schedule(m,t.venue_key,t.game_slug,p_payload);
      else
        delete from private.arena_reservations where tournament_match_id=m.id;
        update private.staff_tournament_matches set match_date=null,start_time=null,arena_number=null,duration=null where id=m.id;
      end if;
    elsif action='start' then
      if m.status<>'scheduled' or m.review or m.match_date is null or m.team_a is null or m.team_b is null then
        raise exception 'Schedule the match and wait for both teams before starting.';
      end if;
      if (select count(*) from private.staff_tournament_teams where tournament_id=t.id and id in (m.team_a,m.team_b) and checked_in)<>2 then
        raise exception 'Check in both teams before starting.';
      end if;
      if exists(select 1 from private.staff_tournament_matches x where x.tournament_id=t.id and x.status='in_progress'
        and (x.team_a in (m.team_a,m.team_b) or x.team_b in (m.team_a,m.team_b))) then
        raise exception 'One of these teams is already playing.';
      end if;
      update private.staff_tournament_matches set status='in_progress',started_at=coalesce(started_at,now()) where id=m.id;
    else
      before_result:=jsonb_build_object('score_a',m.score_a,'score_b',m.score_b,'outcome',m.outcome,'winner',m.winner,
        'team_a',m.team_a,'team_b',m.team_b,'status',m.status,'review',m.review);
      if action='reset' then
        if not m.review or length(reason) not between 3 and 300 then raise exception 'Enter a reason for reopening the flagged match.'; end if;
        update private.staff_tournament_matches set status='scheduled',score_a=null,score_b=null,winner=null,outcome=null,review=false where id=m.id;
        correction:=true;
      else
        if m.review then raise exception 'Resolve the bracket correction before changing this match.'; end if;
        if m.team_a is null or m.team_b is null or m.match_date is null then raise exception 'Schedule the match and wait for both teams.'; end if;
        correction:=m.status='completed';
        if correction and (rank<80 or length(reason) not between 3 and 300) then raise exception 'A manager must enter a reason to correct a result.'; end if;
        result_type:=p_payload->>'outcome';
        if result_type='score' then
          if m.status='scheduled' then raise exception 'Start the match before recording scores.'; end if;
          a:=(p_payload->>'score_a')::integer; b:=(p_payload->>'score_b')::integer;
          if a is null or b is null or a not between 0 and 999 or b not between 0 and 999 then raise exception 'Enter whole scores between 0 and 999.'; end if;
          if a=b and t.format='single_elimination' then raise exception 'A knockout result needs a winner.'; end if;
        elsif result_type in ('forfeit','no_show') and p_payload->>'winner_side' in ('a','b') then
          a:=case when p_payload->>'winner_side'='a' then 1 else 0 end; b:=1-a;
        else
          raise exception 'Choose a result type and the winning team.';
        end if;
        update private.staff_tournament_matches set status='completed',started_at=coalesce(started_at,now()),score_a=a,score_b=b,outcome=result_type,
          winner=case when a>b then m.team_a when b>a then m.team_b end where id=m.id;
      end if;
      if t.format='single_elimination' then perform private.staff_tournament_reconcile(t.id); end if;
      if correction then
        select jsonb_build_object('score_a',x.score_a,'score_b',x.score_b,'outcome',x.outcome,'winner',x.winner,
          'team_a',x.team_a,'team_b',x.team_b,'status',x.status,'review',x.review)
          into after_result from private.staff_tournament_matches x where x.id=m.id;
        insert into private.staff_tournament_result_audit(tournament_id,match_number,action,reason,actor_id,before,after)
          values(t.id,m.number,case when action='reset' then 'reset' else 'correction' end,reason,actor,before_result,after_result);
      end if;
    end if;
  end if;
  update private.staff_team_tournaments set version=version+1 where id=t.id;
  return public.staff_team_tournament_detail(t.id);
end $$;

revoke all on function private.staff_tournament_open_byes(uuid),private.staff_tournament_place_team(uuid,integer,text,uuid),
  private.staff_tournament_reconcile(uuid),private.staff_tournament_generate(uuid,text),
  private.staff_tournament_schedule(private.staff_tournament_matches,text,text,jsonb),
  public.staff_team_tournament_list(),public.staff_team_tournament_detail(uuid),
  public.staff_team_tournament_write(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.staff_team_tournament_list(),public.staff_team_tournament_detail(uuid),
  public.staff_team_tournament_write(uuid,integer,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
