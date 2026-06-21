alter table public.staff_games
  add column if not exists audience text[] not null default array[]::text[];

alter table public.staff_games
  drop constraint if exists staff_games_audience_allowed;

update public.staff_games
set audience = coalesce((
  select array_agg(distinct audience_option.option order by audience_option.option)
  from unnest(public.staff_games.audience) as audience_option(option)
  where audience_option.option = any(array[
    'family_friendly',
    'scary',
    'fun',
    'quest',
    'teamwork',
    'beginner_friendly',
    'competitive'
  ])
), array[]::text[]);

alter table public.staff_games
  add constraint staff_games_audience_allowed
  check (audience <@ array[
    'family_friendly',
    'scary',
    'fun',
    'quest',
    'teamwork',
    'beginner_friendly',
    'competitive'
  ]::text[]);

comment on column public.staff_games.audience is
  'Customer-facing audience tags for staff-managed games. Allowed values: family_friendly, scary, fun, quest, teamwork, beginner_friendly, competitive.';
