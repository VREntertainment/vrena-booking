-- Schema-only Storage RLS baseline through 20260905011752.
-- No objects, uploads, credentials, or customer data are included.
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant usage on schema storage to authenticated;
create policy "avatar deletes by owner" on storage."objects" as permissive for delete to "authenticated"
using (((bucket_id = 'avatars'::text) AND private.can_manage_avatar_object_path(name)));
create policy "avatar reads by owner" on storage."objects" as permissive for select to "authenticated"
using (((bucket_id = 'avatars'::text) AND private.can_manage_avatar_object_path(name)));
create policy "avatar updates by owner" on storage."objects" as permissive for update to "authenticated"
using (((bucket_id = 'avatars'::text) AND private.can_manage_avatar_object_path(name)))
with check (((bucket_id = 'avatars'::text) AND private.can_manage_avatar_object_path(name)));
create policy "avatar uploads by owner" on storage."objects" as permissive for insert to "authenticated"
with check (((bucket_id = 'avatars'::text) AND private.can_manage_avatar_object_path(name)));
create policy "club banner deletes by club managers" on storage."objects" as permissive for delete to "authenticated"
using (((bucket_id = 'club-banners'::text) AND private.can_manage_club_banner_path(name)));
create policy "club banner reads by club managers" on storage."objects" as permissive for select to "authenticated"
using (((bucket_id = 'club-banners'::text) AND private.can_manage_club_banner_path(name)));
create policy "club banner updates by club managers" on storage."objects" as permissive for update to "authenticated"
using (((bucket_id = 'club-banners'::text) AND private.can_manage_club_banner_path(name)))
with check (((bucket_id = 'club-banners'::text) AND private.can_manage_club_banner_path(name)));
create policy "club banner uploads by club managers" on storage."objects" as permissive for insert to "authenticated"
with check (((bucket_id = 'club-banners'::text) AND private.can_manage_club_banner_path(name)));
create policy "permanent accounts only" on storage."objects" as restrictive for all to "authenticated"
using ((NOT COALESCE(( SELECT ((auth.jwt() ->> 'is_anonymous'::text))::boolean AS bool), false)))
with check ((NOT COALESCE(( SELECT ((auth.jwt() ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff game image deletes by managers" on storage."objects" as permissive for delete to "authenticated"
using (((bucket_id = 'staff-game-images'::text) AND private.can_manage_staff_game_image_path(name)));
create policy "staff game image reads by managers" on storage."objects" as permissive for select to "authenticated"
using (((bucket_id = 'staff-game-images'::text) AND private.can_manage_staff_game_image_path(name)));
create policy "staff game image updates by managers" on storage."objects" as permissive for update to "authenticated"
using (((bucket_id = 'staff-game-images'::text) AND private.can_manage_staff_game_image_path(name)))
with check (((bucket_id = 'staff-game-images'::text) AND private.can_manage_staff_game_image_path(name)));
create policy "staff game image uploads by managers" on storage."objects" as permissive for insert to "authenticated"
with check (((bucket_id = 'staff-game-images'::text) AND private.can_manage_staff_game_image_path(name)));
create policy "staff hr document deletes" on storage."objects" as permissive for delete to "authenticated"
using (((bucket_id = 'staff-hr-documents'::text) AND private.can_manage_staff_hr_document_path(name)));
create policy "staff hr document updates" on storage."objects" as permissive for update to "authenticated"
using (((bucket_id = 'staff-hr-documents'::text) AND private.can_manage_staff_hr_document_path(name)))
with check (((bucket_id = 'staff-hr-documents'::text) AND private.can_manage_staff_hr_document_path(name)));
create policy "staff hr document uploads" on storage."objects" as permissive for insert to "authenticated"
with check (((bucket_id = 'staff-hr-documents'::text) AND private.can_manage_staff_hr_document_path(name)));
create policy "staff hr documents read" on storage."objects" as permissive for select to "authenticated"
using (((bucket_id = 'staff-hr-documents'::text) AND private.can_read_staff_hr_document_path(name)));
