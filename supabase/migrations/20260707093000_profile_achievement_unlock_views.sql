begin;

create table if not exists public.profile_achievement_unlock_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_kind text not null check (achievement_kind in ('game', 'retention')),
  achievement_id text not null,
  achievement_tier text not null default 'base',
  first_seen_at timestamptz not null default now(),
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_achievement_unlock_views_unique
  on public.profile_achievement_unlock_views (profile_id, achievement_kind, achievement_id, achievement_tier);

create index if not exists profile_achievement_unlock_views_profile_idx
  on public.profile_achievement_unlock_views (profile_id, first_seen_at desc);

create or replace function public.profile_achievement_unlock_views_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profile_achievement_unlock_views_touch_updated_at on public.profile_achievement_unlock_views;
create trigger profile_achievement_unlock_views_touch_updated_at
before update on public.profile_achievement_unlock_views
for each row
execute function public.profile_achievement_unlock_views_touch_updated_at();

alter table public.profile_achievement_unlock_views enable row level security;

revoke all on public.profile_achievement_unlock_views from public;
grant select, insert, update on public.profile_achievement_unlock_views to authenticated;
grant all on public.profile_achievement_unlock_views to service_role;

drop policy if exists "own achievement unlock views select" on public.profile_achievement_unlock_views;
drop policy if exists "own achievement unlock views insert" on public.profile_achievement_unlock_views;
drop policy if exists "own achievement unlock views update" on public.profile_achievement_unlock_views;

create policy "own achievement unlock views select"
on public.profile_achievement_unlock_views
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "own achievement unlock views insert"
on public.profile_achievement_unlock_views
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "own achievement unlock views update"
on public.profile_achievement_unlock_views
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

notify pgrst, 'reload schema';

commit;
