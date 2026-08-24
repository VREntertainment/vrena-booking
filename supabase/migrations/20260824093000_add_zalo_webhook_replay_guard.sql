begin;

create table if not exists public.zalo_webhook_receipts (
  event_digest text primary key,
  event_timestamp timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint zalo_webhook_receipts_digest_check check (event_digest ~ '^[0-9a-f]{64}$')
);

create index if not exists zalo_webhook_receipts_received_idx
  on public.zalo_webhook_receipts (received_at desc);

alter table public.zalo_webhook_receipts enable row level security;
revoke all on public.zalo_webhook_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.zalo_webhook_receipts to service_role;

drop policy if exists "zalo webhook receipts service only" on public.zalo_webhook_receipts;
create policy "zalo webhook receipts service only" on public.zalo_webhook_receipts
for all to service_role using (true) with check (true);

commit;
