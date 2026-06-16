alter table public.clubs
  add column if not exists pin_code text;

update public.clubs
set pin_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where visibility = 'private'
  and nullif(btrim(pin_code), '') is null;

