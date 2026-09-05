begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Recorded games follow the same catalog as the public guide and staff picker.
-- Keep historical references when a game is deactivated, and preserve them if
-- staff renames a slug. A referenced game must be deactivated instead of deleted.
create index sessions_confirmed_game_id_idx on public.sessions (confirmed_game_id);

alter table public.sessions
  drop constraint sessions_confirmed_game_id_check,
  add constraint sessions_confirmed_game_id_fkey
    foreign key (confirmed_game_id) references public.staff_games (slug)
    on update cascade on delete restrict;

commit;
