create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  avatar_initials text,
  avatar_color text,
  avatar_text_color text,
  profile_motto text,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_display_name text,
  recipient_avatar_url text,
  recipient_avatar_emoji text,
  recipient_avatar_initials text,
  recipient_avatar_color text,
  recipient_avatar_text_color text,
  recipient_profile_motto text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (session_id, recipient_id)
);

create table if not exists public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text,
  author_avatar_url text,
  author_avatar_emoji text,
  author_avatar_initials text,
  author_avatar_color text,
  author_avatar_text_color text,
  author_profile_motto text,
  message_type text not null default 'comment' check (message_type in ('announcement', 'comment')),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.user_follows enable row level security;
alter table public.session_invites enable row level security;
alter table public.session_messages enable row level security;

grant select on public.user_follows to anon;
grant select, insert, delete on public.user_follows to authenticated;
grant select on public.session_invites to anon;
grant select, insert, update, delete on public.session_invites to authenticated;
grant select on public.session_messages to anon;
grant select, insert, delete on public.session_messages to authenticated;

create policy "follows are readable"
on public.user_follows
for select
using (true);

create policy "users manage own follows"
on public.user_follows
for all
using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);

create policy "session invites are readable"
on public.session_invites
for select
using (true);

create policy "users create own invites"
on public.session_invites
for insert
with check (auth.uid() = inviter_id);

create policy "invited users update their invites"
on public.session_invites
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create policy "invite owners can delete invites"
on public.session_invites
for delete
using (auth.uid() = inviter_id or auth.uid() = recipient_id);

create policy "session messages are readable"
on public.session_messages
for select
using (true);

create policy "participants create session messages"
on public.session_messages
for insert
with check (
  auth.uid() = author_id
  and (
    exists (
      select 1 from public.session_participants
      where session_participants.session_id = session_messages.session_id
        and session_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.sessions
      where sessions.id = session_messages.session_id
        and sessions.owner_id = auth.uid()
    )
  )
);

create policy "authors delete own messages"
on public.session_messages
for delete
using (auth.uid() = author_id);
