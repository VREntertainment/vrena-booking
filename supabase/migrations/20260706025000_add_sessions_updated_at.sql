alter table public.sessions
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.staff_set_updated_at();

notify pgrst, 'reload schema';
