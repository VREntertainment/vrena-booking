-- Match existing full_name editing privileges, without widening row access.
grant update (first_name, last_name) on public.profiles to authenticated;
