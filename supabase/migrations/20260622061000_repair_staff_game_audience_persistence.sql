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

update public.staff_games
set audience = coalesce(array_remove(array[
  case when lower(coalesce(difficulty, '')) like '%family%' then 'family_friendly' end,
  case when lower(coalesce(difficulty, '')) like '%scary%' or lower(coalesce(difficulty, '')) like '%hard%' then 'scary' end,
  case when lower(coalesce(difficulty, '')) like '%fun%' or lower(coalesce(difficulty, '')) like '%medium%' then 'fun' end,
  case when lower(coalesce(difficulty, '')) like '%quest%' then 'quest' end,
  case when lower(coalesce(difficulty, '')) like '%team%' then 'teamwork' end,
  case when lower(coalesce(difficulty, '')) like '%beginner%' then 'beginner_friendly' end,
  case when lower(coalesce(difficulty, '')) like '%competitive%' then 'competitive' end
]::text[], null), array[]::text[])
where coalesce(array_length(audience, 1), 0) = 0
  and coalesce(difficulty, '') <> '';

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

grant select, insert, update on public.staff_games to authenticated;
grant select on public.staff_games to anon;

comment on column public.staff_games.audience is
  'Customer-facing audience tags for staff-managed games. Allowed values: family_friendly, scary, fun, quest, teamwork, beginner_friendly, competitive.';
