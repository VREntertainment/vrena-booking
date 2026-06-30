begin;

create or replace function public.can_manage_avatar_object_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and split_part(coalesce(p_object_name, ''), '/', 1) = auth.uid()::text
    and split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
    and position('..' in coalesce(p_object_name, '')) = 0;
$$;

revoke all on function public.can_manage_avatar_object_path(text) from public;
grant execute on function public.can_manage_avatar_object_path(text) to authenticated, service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'avatars',
      'avatars',
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
declare
  v_policy record;
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname ilike '%avatar%'
        or coalesce(qual, '') ilike '%avatars%'
        or coalesce(with_check, '') ilike '%avatars%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;

  create policy "avatar images are public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

  create policy "avatar uploads by owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.can_manage_avatar_object_path(name)
  );

  create policy "avatar updates by owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_manage_avatar_object_path(name)
  )
  with check (
    bucket_id = 'avatars'
    and public.can_manage_avatar_object_path(name)
  );

  create policy "avatar deletes by owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_manage_avatar_object_path(name)
  );
end $$;

commit;
