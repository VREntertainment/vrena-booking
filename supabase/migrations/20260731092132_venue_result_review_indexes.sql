create index if not exists venue_result_reviews_reviewed_by_idx
on public.venue_result_reviews (reviewed_by)
where reviewed_by is not null;
