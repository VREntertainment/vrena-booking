alter table public.staff_games
  add column if not exists guide_language text not null default 'en',
  add column if not exists guide_summary jsonb not null default '{}'::jsonb,
  add column if not exists guide_rules jsonb not null default '{}'::jsonb,
  add column if not exists guide_tips jsonb not null default '{}'::jsonb;

alter table public.staff_games
  drop constraint if exists staff_games_guide_language_allowed;

alter table public.staff_games
  add constraint staff_games_guide_language_allowed
  check (guide_language in ('en', 'vi', 'ko', 'ja', 'fr', 'de', 'it'));

alter table public.staff_games
  drop constraint if exists staff_games_guide_summary_object,
  drop constraint if exists staff_games_guide_rules_object,
  drop constraint if exists staff_games_guide_tips_object;

alter table public.staff_games
  add constraint staff_games_guide_summary_object
  check (jsonb_typeof(guide_summary) = 'object'),
  add constraint staff_games_guide_rules_object
  check (jsonb_typeof(guide_rules) = 'object'),
  add constraint staff_games_guide_tips_object
  check (jsonb_typeof(guide_tips) = 'object');

grant select on public.staff_games to anon, authenticated;

drop policy if exists "staff games active public select" on public.staff_games;
create policy "staff games active public select"
on public.staff_games
for select
to anon, authenticated
using (active = true);

comment on column public.staff_games.guide_language is
  'Default/fallback language for customer-facing game guide text.';
comment on column public.staff_games.guide_summary is
  'Customer-facing game guide summary, stored as a JSON object keyed by language code.';
comment on column public.staff_games.guide_rules is
  'Customer-facing GamePlay/rules text, stored as a JSON object keyed by language code.';
comment on column public.staff_games.guide_tips is
  'Customer-facing game guide tips, stored as a JSON object keyed by language code.';
