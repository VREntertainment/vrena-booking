begin;

drop policy if exists "venue support bundles service only"
on public.venue_support_bundles;
create policy "venue support bundles service only"
on public.venue_support_bundles
for all
to service_role
using (true)
with check (true);

drop policy if exists "venue support download tokens service only"
on public.venue_support_bundle_download_tokens;
create policy "venue support download tokens service only"
on public.venue_support_bundle_download_tokens
for all
to service_role
using (true)
with check (true);

commit;
