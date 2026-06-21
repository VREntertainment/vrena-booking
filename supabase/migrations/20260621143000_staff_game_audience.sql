alter table public.staff_games
  add column if not exists audience text[] not null default array[]::text[];

update public.staff_games
set audience = coalesce((
  select array_agg(distinct audience_option.option order by audience_option.option)
  from unnest(public.staff_games.audience) as audience_option(option)
  where audience_option.option = any(array['family_friendly', 'scary', 'fun'])
), array[]::text[]);

update public.staff_games
set audience = case
  when lower(coalesce(difficulty, '')) like '%family%' then array['family_friendly']::text[]
  when lower(coalesce(difficulty, '')) like '%scary%' then array['scary']::text[]
  when lower(coalesce(difficulty, '')) like '%hard%' then array['scary']::text[]
  when lower(coalesce(difficulty, '')) like '%medium%' then array['fun']::text[]
  when lower(coalesce(difficulty, '')) like '%fun%' then array['fun']::text[]
  when lower(coalesce(difficulty, '')) like '%easy%' then array['family_friendly', 'fun']::text[]
  else audience
end
where coalesce(array_length(audience, 1), 0) = 0
  and coalesce(difficulty, '') <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_games_audience_allowed'
      and conrelid = 'public.staff_games'::regclass
  ) then
    alter table public.staff_games
      add constraint staff_games_audience_allowed
      check (audience <@ array['family_friendly', 'scary', 'fun']::text[]);
  end if;
end $$;

comment on column public.staff_games.audience is
  'Customer-facing audience tags for staff-managed games. Allowed values: family_friendly, scary, fun.';
