begin;

alter table public.player_zalo_identities
  alter column verified_phone drop not null;

comment on column public.player_zalo_identities.verified_phone is
  'Optional historical phone number for identities created before Zalo-ID-only registration. New Mini App profiles do not request phone access.';

notify pgrst, 'reload schema';

commit;
