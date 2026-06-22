create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text,
  author_avatar_url text,
  author_avatar_emoji text,
  author_avatar_initials text,
  author_avatar_color text,
  author_avatar_text_color text,
  author_profile_motto text,
  message_type text not null default 'public',
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  delete_reason text
);

alter table public.club_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists delete_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_messages_message_type_check'
      and conrelid = 'public.club_messages'::regclass
  ) then
    alter table public.club_messages
      add constraint club_messages_message_type_check
      check (message_type in ('public', 'admin_private'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_messages_body_length_check'
      and conrelid = 'public.club_messages'::regclass
  ) then
    alter table public.club_messages
      add constraint club_messages_body_length_check
      check (char_length(trim(body)) between 1 and 150);
  end if;
end $$;

create index if not exists club_messages_club_created_idx
on public.club_messages (club_id, created_at desc)
where deleted_at is null;

create index if not exists club_messages_club_type_created_idx
on public.club_messages (club_id, message_type, created_at desc)
where deleted_at is null;

create or replace function public.can_use_club_messages(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_vrena_admin()
    or exists (
      select 1
      from public.clubs
      where clubs.id = p_club_id
        and clubs.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.club_members
      where club_members.club_id = p_club_id
        and club_members.profile_id = auth.uid()
        and club_members.status = 'approved'
        and club_members.deleted_at is null
    );
$$;

alter table public.club_messages enable row level security;

grant select on public.club_messages to anon, authenticated;
grant insert on public.club_messages to authenticated;
grant update (deleted_at, deleted_by, delete_reason) on public.club_messages to authenticated;
grant execute on function public.can_use_club_messages(uuid) to anon, authenticated;

drop policy if exists "club messages are readable by club members" on public.club_messages;
drop policy if exists "club members create club messages" on public.club_messages;
drop policy if exists "club messages soft deleted by authors or admins" on public.club_messages;

create policy "club messages are readable by club members"
on public.club_messages
for select
using (
  deleted_at is null
  and (
    (
      message_type = 'public'
      and public.can_use_club_messages(club_id)
    )
    or (
      message_type = 'admin_private'
      and (
        author_id = auth.uid()
        or public.can_manage_club_settings(club_id)
      )
    )
  )
);

create policy "club members create club messages"
on public.club_messages
for insert
with check (
  auth.uid() = author_id
  and deleted_at is null
  and message_type in ('public', 'admin_private')
  and char_length(trim(body)) between 1 and 150
  and public.can_use_club_messages(club_id)
);

create policy "club messages soft deleted by authors or admins"
on public.club_messages
for update
using (
  deleted_at is null
  and (
    author_id = auth.uid()
    or public.can_manage_club_settings(club_id)
  )
)
with check (
  author_id = auth.uid()
  or public.can_manage_club_settings(club_id)
);
