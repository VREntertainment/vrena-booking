create table if not exists public.message_translations (
  id uuid primary key default gen_random_uuid(),
  message_table text not null check (message_table in ('session_messages', 'club_messages')),
  message_id uuid not null,
  source_body_hash text not null,
  target_language text not null check (target_language in ('en', 'vi', 'ko', 'ja', 'fr', 'de', 'it')),
  source_language text,
  translated_body text not null,
  changed boolean not null default true,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_table, message_id, source_body_hash, target_language)
);

create index if not exists message_translations_message_idx
on public.message_translations (message_table, message_id);

alter table public.message_translations enable row level security;

grant select, insert, update on public.message_translations to service_role;
