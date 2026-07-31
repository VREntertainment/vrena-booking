create or replace function public.protect_minor_birthday_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.birthday is distinct from old.birthday
    and old.birthday is not null
    and old.birthday > (current_date - interval '18 years')::date
    and auth.uid() = old.id
  then
    raise exception using
      errcode = 'P0001',
      message = 'A child''s date of birth can only be changed by the VRena team.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_minor_birthday on public.profiles;
create trigger profiles_protect_minor_birthday
before update of birthday on public.profiles
for each row execute function public.protect_minor_birthday_change();

revoke all on function public.protect_minor_birthday_change() from public, anon, authenticated;

comment on function public.protect_minor_birthday_change() is
  'Prevents a logged-in minor from changing their own saved birthday; trusted VRena staff service flows remain available for corrections.';
