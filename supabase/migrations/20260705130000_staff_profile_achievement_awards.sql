begin;

create table if not exists public.profile_achievement_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  achievement_kind text not null default 'retention' check (achievement_kind in ('game', 'retention')),
  title text not null,
  description text,
  note text,
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profile_achievement_awards_active_unique
  on public.profile_achievement_awards (profile_id, achievement_kind, achievement_id)
  where revoked_at is null;

create index if not exists profile_achievement_awards_profile_active_idx
  on public.profile_achievement_awards (profile_id, awarded_at desc)
  where revoked_at is null;

create index if not exists profile_achievement_awards_awarded_by_idx
  on public.profile_achievement_awards (awarded_by, awarded_at desc);

create or replace function public.profile_achievement_awards_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profile_achievement_awards_touch_updated_at on public.profile_achievement_awards;
create trigger profile_achievement_awards_touch_updated_at
before update on public.profile_achievement_awards
for each row
execute function public.profile_achievement_awards_touch_updated_at();

alter table public.profile_achievement_awards enable row level security;

revoke all on public.profile_achievement_awards from public;
grant select on public.profile_achievement_awards to authenticated;
grant all on public.profile_achievement_awards to service_role;

drop policy if exists "own achievement awards select" on public.profile_achievement_awards;
drop policy if exists "staff achievement awards select" on public.profile_achievement_awards;

create policy "own achievement awards select"
on public.profile_achievement_awards
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "staff achievement awards select"
on public.profile_achievement_awards
for select
to authenticated
using (public.is_staff_console_user(50));

create or replace function public.staff_award_profile_achievement(
  p_profile_id uuid,
  p_achievement_id text,
  p_achievement_kind text,
  p_title text,
  p_description text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_rank integer := coalesce(public.current_staff_role_rank(), 0);
  v_achievement_id text := nullif(trim(coalesce(p_achievement_id, '')), '');
  v_achievement_kind text := nullif(trim(coalesce(p_achievement_kind, '')), '');
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_award public.profile_achievement_awards%rowtype;
begin
  if v_actor is null then
    raise exception 'Login required.';
  end if;

  if v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_profile_id is null then
    raise exception 'Choose a player first.';
  end if;

  if v_achievement_id is null or length(v_achievement_id) > 120 then
    raise exception 'Choose a valid achievement.';
  end if;

  if v_achievement_kind not in ('game', 'retention') then
    raise exception 'Choose a valid achievement type.';
  end if;

  if v_title is null or length(v_title) > 160 then
    raise exception 'Achievement title is required.';
  end if;

  if v_description is not null and length(v_description) > 500 then
    raise exception 'Achievement description is too long.';
  end if;

  if v_note is not null and length(v_note) > 500 then
    raise exception 'Staff note is too long.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_profile_id
      and deleted_at is null
  ) then
    raise exception 'Player profile not found.';
  end if;

  if exists (
    select 1
    from public.profile_achievement_awards
    where profile_id = p_profile_id
      and achievement_kind = v_achievement_kind
      and achievement_id = v_achievement_id
      and revoked_at is null
  ) then
    raise exception 'Already awarded to this player.';
  end if;

  insert into public.profile_achievement_awards (
    profile_id,
    achievement_id,
    achievement_kind,
    title,
    description,
    note,
    awarded_by
  )
  values (
    p_profile_id,
    v_achievement_id,
    v_achievement_kind,
    v_title,
    v_description,
    v_note,
    v_actor
  )
  returning * into v_award;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, new_value)
    values (
      v_actor,
      'achievement_awarded',
      'profile_achievement_awards',
      v_award.id,
      jsonb_build_object(
        'profile_id', v_award.profile_id,
        'achievement_id', v_award.achievement_id,
        'achievement_kind', v_award.achievement_kind,
        'title', v_award.title
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_award.id,
    'profile_id', v_award.profile_id,
    'achievement_id', v_award.achievement_id,
    'achievement_kind', v_award.achievement_kind,
    'title', v_award.title,
    'awarded_at', v_award.awarded_at
  );
end;
$$;

revoke all on function public.staff_award_profile_achievement(uuid, text, text, text, text, text) from public;
grant execute on function public.staff_award_profile_achievement(uuid, text, text, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
