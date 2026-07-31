-- BookingWidget already listens for profile changes so an open session can
-- immediately pick up promotions and demotions. Publish the table that backs
-- those changes; Realtime continues to apply the table's existing RLS policies.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
