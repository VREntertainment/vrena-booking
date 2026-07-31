begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'venue-result-reviews',
  'venue-result-reviews',
  false,
  2000000,
  array['image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.venue_result_reviews (
  id uuid primary key default gen_random_uuid(),
  source_capture_id text not null unique,
  storage_path text not null unique,
  captured_at timestamptz not null,
  source_device text not null,
  app_version text not null,
  review_reason text not null,
  sha256 text not null,
  ocr_text text not null default '',
  review_status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  constraint venue_result_reviews_capture_id_check
    check (source_capture_id ~ '^[0-9a-f]{64}$'),
  constraint venue_result_reviews_storage_path_check
    check (storage_path ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-f-]{36}/[0-9a-f]{64}\.jpg$'),
  constraint venue_result_reviews_source_device_check
    check (char_length(source_device) between 1 and 120),
  constraint venue_result_reviews_app_version_check
    check (char_length(app_version) between 1 and 40),
  constraint venue_result_reviews_reason_check
    check (review_reason in ('game_not_recognized', 'players_not_recognized')),
  constraint venue_result_reviews_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint venue_result_reviews_ocr_text_check
    check (char_length(ocr_text) <= 100000),
  constraint venue_result_reviews_status_check
    check (review_status in ('pending', 'resolved', 'dismissed')),
  constraint venue_result_reviews_review_pair_check
    check (
      (review_status = 'pending' and reviewed_at is null)
      or
      (review_status <> 'pending' and reviewed_at is not null)
    ),
  constraint venue_result_reviews_notes_check
    check (review_notes is null or char_length(review_notes) <= 2000)
);

create index if not exists venue_result_reviews_pending_idx
on public.venue_result_reviews (created_at asc)
where review_status = 'pending';

alter table public.venue_result_reviews enable row level security;

revoke all on table public.venue_result_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.venue_result_reviews to service_role;

drop policy if exists "venue result reviews service only"
on public.venue_result_reviews;
create policy "venue result reviews service only"
on public.venue_result_reviews
for all
to service_role
using (true)
with check (true);

comment on table public.venue_result_reviews is
  'Private queue of result screenshots that the Windows capture app could not recognize completely.';

commit;
