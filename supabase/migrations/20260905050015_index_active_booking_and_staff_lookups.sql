begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Cover reverse membership, invitation, staff scheduling, and result lookups.
-- Existing composite indexes begin with other columns. The largest affected
-- table has 547 rows in the release audit; bounded transactional builds are brief.
-- Retain low-use audit indexes and defer extra indexes on tiny configuration tables.
create index if not exists sessions_club_id_idx on public.sessions (club_id);
create index if not exists club_members_profile_id_idx on public.club_members (profile_id);
create index if not exists session_invites_recipient_id_idx on public.session_invites (recipient_id);
create index if not exists session_invites_inviter_id_idx on public.session_invites (inviter_id);
create index if not exists session_waitlist_profile_id_idx on public.session_waitlist (profile_id);
create index if not exists user_follows_following_id_idx on public.user_follows (following_id);
create index if not exists staff_kiosk_operator_sessions_operator_profile_id_idx on private.staff_kiosk_operator_sessions (operator_profile_id);
create index if not exists staff_attendance_logs_shift_id_idx on public.staff_attendance_logs (shift_id);
create index if not exists venue_game_results_matched_participant_id_idx on public.venue_game_results (matched_participant_id);
create index if not exists staff_orders_game_id_idx on public.staff_orders (game_id);

commit;
