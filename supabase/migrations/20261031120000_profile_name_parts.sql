-- Additive account fields. Keep full_name for existing booking, staff and Zalo clients.
-- No backfill: splitting a legacy name automatically would guess the customer's surname.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;
comment on column public.profiles.first_name is 'Customer-entered given name. Null for legacy full-name profiles.';
comment on column public.profiles.last_name is 'Customer-entered surname. Optional; never inferred from full_name.';
-- Existing profile row-level policies continue to govern both fields.
