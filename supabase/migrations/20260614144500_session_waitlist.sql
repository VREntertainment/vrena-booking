create table if not exists public.session_waitlist (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

alter table public.session_waitlist enable row level security;

grant select on public.session_waitlist to anon;
grant select, insert, delete on public.session_waitlist to authenticated;

create policy "waitlist rows are readable"
on public.session_waitlist
for select
using (true);

create policy "users can join their own waitlist"
on public.session_waitlist
for insert
with check (auth.uid() = profile_id);

create policy "users can leave their own waitlist"
on public.session_waitlist
for delete
using (auth.uid() = profile_id);

create policy "session owners can manage waitlist"
on public.session_waitlist
for delete
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_waitlist.session_id
      and sessions.owner_id = auth.uid()
  )
);

create policy "admins can manage waitlist"
on public.session_waitlist
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.promote_session_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_waitlist public.session_waitlist%rowtype;
  v_participant_count integer;
begin
  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and status <> 'cancelled'
  for update;

  if not found then
    return;
  end if;

  select count(*)
  into v_participant_count
  from public.session_participants
  where session_id = p_session_id;

  if v_participant_count >= v_session.max_players then
    return;
  end if;

  select *
  into v_waitlist
  from public.session_waitlist
  where session_id = p_session_id
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.session_participants
    where session_id = p_session_id
      and profile_id = v_waitlist.profile_id
  ) then
    insert into public.session_participants (
      session_id,
      profile_id,
      display_name,
      avatar_url,
      avatar_emoji,
      avatar_initials,
      avatar_color,
      avatar_text_color,
      profile_motto
    ) values (
      v_waitlist.session_id,
      v_waitlist.profile_id,
      v_waitlist.display_name,
      v_waitlist.avatar_url,
      v_waitlist.avatar_emoji,
      v_waitlist.avatar_initials,
      v_waitlist.avatar_color,
      v_waitlist.avatar_text_color,
      v_waitlist.profile_motto
    );
  end if;

  delete from public.session_waitlist where id = v_waitlist.id;
end;
$$;

grant execute on function public.promote_session_waitlist(uuid) to authenticated;
