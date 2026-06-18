create or replace function public.can_manage_staff_game_image_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_staff_console_user(80)
    and coalesce(p_object_name, '') <> '';
$$;

revoke all on function public.can_manage_staff_game_image_path(text) from public;
grant execute on function public.can_manage_staff_game_image_path(text) to authenticated, service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'staff-game-images',
      'staff-game-images',
      true,
      2097152,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game images are public'
  ) then
    create policy "staff game images are public"
    on storage.objects
    for select
    using (bucket_id = 'staff-game-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image uploads by managers'
  ) then
    create policy "staff game image uploads by managers"
    on storage.objects
    for insert
    with check (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image updates by managers'
  ) then
    create policy "staff game image updates by managers"
    on storage.objects
    for update
    using (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    )
    with check (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'staff game image deletes by managers'
  ) then
    create policy "staff game image deletes by managers"
    on storage.objects
    for delete
    using (
      bucket_id = 'staff-game-images'
      and public.can_manage_staff_game_image_path(name)
    );
  end if;
end $$;
