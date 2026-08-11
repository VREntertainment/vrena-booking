alter table public.venue_result_reviews
drop constraint if exists venue_result_reviews_reason_check;

alter table public.venue_result_reviews
add constraint venue_result_reviews_reason_check
check (
  review_reason in (
    'game_not_recognized',
    'players_not_recognized',
    'escape_time_not_recognized',
    'player_rows_conflict',
    'player_rows_incomplete',
    'player_count_invalid'
  )
);
