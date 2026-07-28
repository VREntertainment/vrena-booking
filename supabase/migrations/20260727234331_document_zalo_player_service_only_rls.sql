begin;

create policy player_zalo_identities_deny_browser_access
on public.player_zalo_identities
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy player_zalo_handoffs_deny_browser_access
on public.player_zalo_handoffs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on policy player_zalo_identities_deny_browser_access
on public.player_zalo_identities is
  'Identity mappings are intentionally service-role only; browser roles receive no table grants.';
comment on policy player_zalo_handoffs_deny_browser_access
on public.player_zalo_handoffs is
  'Handoff tokens are intentionally service-role only; browser roles receive no table grants.';

notify pgrst, 'reload schema';

commit;
