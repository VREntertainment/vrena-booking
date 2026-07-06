alter table public.session_participants
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists session_participants_set_updated_at on public.session_participants;
create trigger session_participants_set_updated_at
before update on public.session_participants
for each row execute function public.staff_set_updated_at();

notify pgrst, 'reload schema';
