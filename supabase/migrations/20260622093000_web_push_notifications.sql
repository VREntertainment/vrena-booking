begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  disabled_at timestamptz,
  fail_count integer not null default 0,
  last_error text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null unique,
  event_type text not null,
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/',
  metadata jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  check (status in ('pending', 'sent', 'failed', 'no_subscription', 'skipped'))
);

create index if not exists push_subscriptions_profile_active_idx
on public.push_subscriptions (profile_id, updated_at desc)
where disabled_at is null;

create index if not exists push_events_due_idx
on public.push_events (status, scheduled_for, created_at)
where processed_at is null;

create index if not exists push_events_recipient_created_idx
on public.push_events (recipient_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_events enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.push_events to authenticated;
grant all on public.push_subscriptions to service_role;
grant all on public.push_events to service_role;

drop policy if exists "users read own push subscriptions" on public.push_subscriptions;
drop policy if exists "users create own push subscriptions" on public.push_subscriptions;
drop policy if exists "users update own push subscriptions" on public.push_subscriptions;
drop policy if exists "users delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "users read own push events" on public.push_events;

create policy "users read own push subscriptions"
on public.push_subscriptions
for select
using (auth.uid() = profile_id);

create policy "users create own push subscriptions"
on public.push_subscriptions
for insert
with check (auth.uid() = profile_id);

create policy "users update own push subscriptions"
on public.push_subscriptions
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create policy "users delete own push subscriptions"
on public.push_subscriptions
for delete
using (auth.uid() = profile_id);

create policy "users read own push events"
on public.push_events
for select
using (auth.uid() = recipient_id);

create or replace function public.push_session_body(p_name text, p_date date, p_start time)
returns text
language sql
stable
as $$
  select concat(
    coalesce(nullif(btrim(p_name), ''), 'VRena session'),
    ' · ',
    to_char(p_date, 'Mon DD'),
    ' ',
    to_char(p_start, 'HH24:MI')
  );
$$;

create or replace function public.enqueue_push_event(
  p_recipient_id uuid,
  p_event_key text,
  p_event_type text,
  p_session_id uuid,
  p_title text,
  p_body text,
  p_url text default '/',
  p_metadata jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if p_recipient_id is null or nullif(btrim(coalesce(p_event_key, '')), '') is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_recipient_id
      and profiles.deleted_at is null
  ) then
    return false;
  end if;

  insert into public.push_events (
    recipient_id,
    event_key,
    event_type,
    session_id,
    title,
    body,
    url,
    metadata,
    scheduled_for
  )
  values (
    p_recipient_id,
    p_event_key,
    p_event_type,
    p_session_id,
    coalesce(nullif(btrim(p_title), ''), 'VRena'),
    coalesce(nullif(btrim(p_body), ''), 'New VRena update.'),
    coalesce(nullif(btrim(p_url), ''), '/'),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_scheduled_for, now())
  )
  on conflict (event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

revoke all on function public.enqueue_push_event(uuid, text, text, uuid, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.enqueue_push_event(uuid, text, text, uuid, text, text, text, jsonb, timestamptz) to authenticated, service_role;

create or replace function public.enqueue_due_session_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    with active_sessions as (
      select
        sessions.id,
        sessions.name,
        sessions.date,
        sessions.start_time,
        (sessions.date::timestamp + sessions.start_time::time) as starts_at
      from public.sessions
      where sessions.status <> 'cancelled'
        and sessions.deleted_at is null
        and (sessions.date::timestamp + sessions.start_time::time) > now() - interval '10 minutes'
        and (sessions.date::timestamp + sessions.start_time::time) <= now() + interval '25 hours'
    )
    select distinct
      participants.profile_id,
      active_sessions.id as session_id,
      active_sessions.name,
      active_sessions.date,
      active_sessions.start_time,
      reminders.key,
      reminders.title,
      reminders.scheduled_for
    from active_sessions
    join public.session_participants as participants
      on participants.session_id = active_sessions.id
     and participants.deleted_at is null
    cross join lateral (
      values
        ('24h'::text, 'Session tomorrow'::text, active_sessions.starts_at - interval '24 hours'),
        ('2h'::text, 'Session soon'::text, active_sessions.starts_at - interval '2 hours')
    ) as reminders(key, title, scheduled_for)
    where reminders.scheduled_for <= now() + interval '5 minutes'
      and reminders.scheduled_for >= now() - interval '6 hours'
  loop
    if public.enqueue_push_event(
      v_row.profile_id,
      'session-reminder:' || v_row.key || ':' || v_row.session_id::text,
      'session_reminder',
      v_row.session_id,
      v_row.title,
      public.push_session_body(v_row.name, v_row.date, v_row.start_time),
      '/',
      jsonb_build_object('reminder', v_row.key),
      v_row.scheduled_for
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_session_reminders() from public;
grant execute on function public.enqueue_due_session_reminders() to service_role;

create or replace function public.enqueue_session_invite_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_title text;
begin
  select name, date, start_time, booking_type
  into v_session
  from public.sessions
  where id = new.session_id
    and deleted_at is null;

  if not found then
    return new;
  end if;

  v_title := case
    when coalesce(v_session.booking_type, 'community') = 'challenge' then 'Challenge invite'
    else 'Session invitation'
  end;

  perform public.enqueue_push_event(
    new.recipient_id,
    'session-invite:' || new.id::text,
    'session_invite',
    new.session_id,
    v_title,
    public.push_session_body(v_session.name, v_session.date, v_session.start_time),
    '/',
    jsonb_build_object('invite_id', new.id),
    now()
  );

  return new;
end;
$$;

drop trigger if exists session_invites_enqueue_push on public.session_invites;
create trigger session_invites_enqueue_push
after insert on public.session_invites
for each row
when (new.status = 'pending')
execute function public.enqueue_session_invite_push();

create or replace function public.enqueue_session_change_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant record;
  v_title text;
  v_key_prefix text;
begin
  if old.name is not distinct from new.name
    and old.date is not distinct from new.date
    and old.start_time is not distinct from new.start_time
    and old.duration_minutes is not distinct from new.duration_minutes
    and old.status is not distinct from new.status
  then
    return new;
  end if;

  v_title := case
    when new.status = 'cancelled' and old.status is distinct from new.status then 'Session cancelled'
    else 'Session updated'
  end;
  v_key_prefix := case
    when new.status = 'cancelled' and old.status is distinct from new.status then 'session-cancelled'
    else 'session-updated'
  end;

  for v_participant in
    select profile_id
    from public.session_participants
    where session_id = new.id
      and deleted_at is null
  loop
    perform public.enqueue_push_event(
      v_participant.profile_id,
      v_key_prefix || ':' || new.id::text || ':' || v_participant.profile_id::text || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
      v_key_prefix,
      new.id,
      v_title,
      public.push_session_body(new.name, new.date, new.start_time),
      '/',
      jsonb_build_object('status', new.status),
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists sessions_enqueue_change_push on public.sessions;
create trigger sessions_enqueue_change_push
after update of name, date, start_time, duration_minutes, status on public.sessions
for each row
execute function public.enqueue_session_change_push();

create or replace function public.enqueue_club_session_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
begin
  if new.club_id is null or new.deleted_at is not null then
    return new;
  end if;

  for v_recipient in
    select owner_id as profile_id
    from public.clubs
    where id = new.club_id
      and owner_id is distinct from new.owner_id
    union
    select profile_id
    from public.club_members
    where club_id = new.club_id
      and status = 'approved'
      and deleted_at is null
      and profile_id is distinct from new.owner_id
  loop
    perform public.enqueue_push_event(
      v_recipient.profile_id,
      'club-session:' || new.id::text || ':' || v_recipient.profile_id::text,
      'club_session_created',
      new.id,
      'New club session',
      public.push_session_body(new.name, new.date, new.start_time),
      '/',
      jsonb_build_object('club_id', new.club_id),
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists sessions_enqueue_club_push on public.sessions;
create trigger sessions_enqueue_club_push
after insert on public.sessions
for each row
execute function public.enqueue_club_session_push();

create or replace function public.enqueue_waitlist_promotion_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  if not exists (
    select 1
    from public.session_participants
    where session_id = old.session_id
      and profile_id = old.profile_id
      and deleted_at is null
  ) then
    return old;
  end if;

  select name, date, start_time
  into v_session
  from public.sessions
  where id = old.session_id
    and deleted_at is null;

  if not found then
    return old;
  end if;

  perform public.enqueue_push_event(
    old.profile_id,
    'waitlist-promoted:' || old.session_id::text || ':' || old.profile_id::text,
    'waitlist_promoted',
    old.session_id,
    'Seat confirmed',
    public.push_session_body(v_session.name, v_session.date, v_session.start_time),
    '/',
    '{}'::jsonb,
    now()
  );

  return old;
end;
$$;

do $$
begin
  if to_regclass('public.session_waitlist') is not null then
    execute 'drop trigger if exists session_waitlist_enqueue_promotion_push on public.session_waitlist';
    execute 'create trigger session_waitlist_enqueue_promotion_push after delete on public.session_waitlist for each row execute function public.enqueue_waitlist_promotion_push()';
  end if;
end $$;

create or replace function public.enqueue_club_admin_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_club_name text;
begin
  if new.message_type <> 'admin_private' or new.deleted_at is not null then
    return new;
  end if;

  select name
  into v_club_name
  from public.clubs
  where id = new.club_id;

  for v_recipient in
    select owner_id as profile_id
    from public.clubs
    where id = new.club_id
      and owner_id is distinct from new.author_id
    union
    select profile_id
    from public.club_members
    where club_id = new.club_id
      and status = 'approved'
      and role = 'admin'
      and deleted_at is null
      and profile_id is distinct from new.author_id
  loop
    perform public.enqueue_push_event(
      v_recipient.profile_id,
      'club-admin-message:' || new.id::text || ':' || v_recipient.profile_id::text,
      'club_admin_message',
      null,
      'Club admin message',
      coalesce(nullif(v_club_name, ''), 'VRena club') || ': ' || left(new.body, 90),
      '/',
      jsonb_build_object('club_id', new.club_id, 'message_id', new.id),
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists club_messages_enqueue_admin_push on public.club_messages;
create trigger club_messages_enqueue_admin_push
after insert on public.club_messages
for each row
execute function public.enqueue_club_admin_message_push();

commit;
