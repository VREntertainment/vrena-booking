begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Cache request-constant auth checks, make named-account requirements explicit,
-- and combine permissive expressions with OR for the same role and operation.
-- Restrictive policies stay restrictive; write predicates never inherit read access.

-- public.audit_logs
drop policy "permanent accounts only" on "public"."audit_logs";
drop policy "staff audit insert" on "public"."audit_logs";
drop policy "staff audit select" on "public"."audit_logs";
create policy "permanent accounts only" on "public"."audit_logs"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff audit insert" on "public"."audit_logs"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff audit select" on "public"."audit_logs"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.blocked_times
drop policy "Admins create blocked times" on "public"."blocked_times";
drop policy "Admins delete blocked times" on "public"."blocked_times";
drop policy "Admins update blocked times" on "public"."blocked_times";
drop policy "Blocked times are visible" on "public"."blocked_times";
drop policy "permanent accounts only" on "public"."blocked_times";
create policy "Admins create blocked times" on "public"."blocked_times"
  as permissive for insert to "authenticated"
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Admins delete blocked times" on "public"."blocked_times"
  as permissive for delete to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Admins update blocked times" on "public"."blocked_times"
  as permissive for update to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Blocked times are visible" on "public"."blocked_times"
  as permissive for select to "authenticated"
  using ((true) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."blocked_times"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.club_members
drop policy "Users or club creators remove club members" on "public"."club_members";
drop policy "Visible club members can be read" on "public"."club_members";
drop policy "club member roles managed by authorized roles" on "public"."club_members";
drop policy "club members readable by allowed users" on "public"."club_members";
drop policy "club members removed by authorized roles" on "public"."club_members";
drop policy "permanent accounts only" on "public"."club_members";
drop policy "users insert own club membership rows" on "public"."club_members";
create policy "authenticated delete access" on "public"."club_members"
  as permissive for delete to "authenticated"
  using (((((profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM clubs c
  WHERE ((c.id = club_members.club_id) AND ((c.owner_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100)))))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_manage_club_member(club_id, profile_id, role)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "authenticated select access" on "public"."club_members"
  as permissive for select to "authenticated"
  using ((((EXISTS ( SELECT 1
   FROM clubs c
  WHERE ((c.id = club_members.club_id) AND ((c.visibility = 'public'::text) OR (c.owner_id = (select auth.uid())) OR (club_members.profile_id = (select auth.uid()))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_read_club_member_row(club_id, profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "club member roles managed by authorized roles" on "public"."club_members"
  as permissive for update to "authenticated"
  using ((private.can_manage_club_member(club_id, profile_id, role)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.can_manage_club_member(club_id, profile_id, role)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."club_members"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users insert own club membership rows" on "public"."club_members"
  as permissive for insert to "authenticated"
  with check ((((deleted_at IS NULL) AND private.can_insert_club_member_row(club_id, profile_id, status) AND ((role = 'member'::text) OR ((role = 'owner'::text) AND (EXISTS ( SELECT 1
   FROM clubs
  WHERE ((clubs.id = club_members.club_id) AND (clubs.owner_id = ( SELECT auth.uid() AS uid))))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.club_messages
drop policy "club members create club messages" on "public"."club_messages";
drop policy "club messages are readable by club members" on "public"."club_messages";
drop policy "club messages soft deleted by authors or admins" on "public"."club_messages";
drop policy "permanent accounts only" on "public"."club_messages";
create policy "club members create club messages" on "public"."club_messages"
  as permissive for insert to "authenticated"
  with check (((((select auth.uid()) = author_id) AND (deleted_at IS NULL) AND (message_type = ANY (ARRAY['public'::text, 'admin_private'::text])) AND ((char_length(TRIM(BOTH FROM body)) >= 1) AND (char_length(TRIM(BOTH FROM body)) <= 150)) AND private.can_use_club_messages(club_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "club messages are readable by club members" on "public"."club_messages"
  as permissive for select to "authenticated"
  using ((((deleted_at IS NULL) AND (((message_type = 'public'::text) AND private.can_use_club_messages(club_id)) OR ((message_type = 'admin_private'::text) AND ((author_id = (select auth.uid())) OR private.can_manage_club_settings(club_id)))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "club messages soft deleted by authors or admins" on "public"."club_messages"
  as permissive for update to "authenticated"
  using ((((deleted_at IS NULL) AND ((author_id = (select auth.uid())) OR private.can_manage_club_settings(club_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((author_id = (select auth.uid())) OR private.can_manage_club_settings(club_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."club_messages"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.clubs
drop policy "Club creators delete clubs" on "public"."clubs";
drop policy "Club creators update clubs" on "public"."clubs";
drop policy "Clubs are visible to authenticated users" on "public"."clubs";
drop policy "Users create clubs" on "public"."clubs";
drop policy "club settings editable by authorized club roles" on "public"."clubs";
drop policy "permanent accounts only" on "public"."clubs";
create policy "Club creators delete clubs" on "public"."clubs"
  as permissive for delete to "authenticated"
  using (((((select auth.uid()) = owner_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100)))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Clubs are visible to authenticated users" on "public"."clubs"
  as permissive for select to "authenticated"
  using ((true) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Users create clubs" on "public"."clubs"
  as permissive for insert to "authenticated"
  with check ((((select auth.uid()) = owner_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated update access" on "public"."clubs"
  as permissive for update to "authenticated"
  using (((private.can_manage_club_settings(id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((((select auth.uid()) = owner_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100)))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))))
  with check (((private.can_manage_club_settings(id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((((select auth.uid()) = owner_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100)))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."clubs"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.loyalty_point_transactions
drop policy "loyalty transactions own read" on "public"."loyalty_point_transactions";
drop policy "loyalty transactions staff insert" on "public"."loyalty_point_transactions";
drop policy "permanent accounts only" on "public"."loyalty_point_transactions";
create policy "loyalty transactions own read" on "public"."loyalty_point_transactions"
  as permissive for select to "authenticated"
  using ((((profile_id = ( SELECT auth.uid() AS uid)) OR private.is_staff_console_user(20))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "loyalty transactions staff insert" on "public"."loyalty_point_transactions"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."loyalty_point_transactions"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.marketing_list
drop policy "admins read marketing list" on "public"."marketing_list";
drop policy "permanent accounts only" on "public"."marketing_list";
drop policy "users manage own marketing consent row" on "public"."marketing_list";
create policy "authenticated select access" on "public"."marketing_list"
  as permissive for select to "authenticated"
  using (((private.is_vrena_admin()) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."marketing_list"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users manage own marketing consent row" on "public"."marketing_list"
  as permissive for update to "authenticated"
  using (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users manage own marketing consent row delete" on "public"."marketing_list"
  as permissive for delete to "authenticated"
  using (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users manage own marketing consent row insert" on "public"."marketing_list"
  as permissive for insert to "authenticated"
  with check (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.player_stat_overrides
drop policy "staff player stat overrides select" on "public"."player_stat_overrides";
create policy "staff player stat overrides select" on "public"."player_stat_overrides"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.pricing_rules
drop policy "Admins manage pricing rules" on "public"."pricing_rules";
drop policy "Pricing rules are visible" on "public"."pricing_rules";
drop policy "permanent accounts only" on "public"."pricing_rules";
create policy "Admins manage pricing rules" on "public"."pricing_rules"
  as permissive for update to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Admins manage pricing rules delete" on "public"."pricing_rules"
  as permissive for delete to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Admins manage pricing rules insert" on "public"."pricing_rules"
  as permissive for insert to "authenticated"
  with check (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."pricing_rules"
  as permissive for select to "authenticated"
  using ((((active = true)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (( SELECT current_staff_role_rank() AS current_staff_role_rank) >= 100))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."pricing_rules"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.profile_achievement_awards
drop policy "own achievement awards select" on "public"."profile_achievement_awards";
drop policy "permanent accounts only" on "public"."profile_achievement_awards";
drop policy "staff achievement awards select" on "public"."profile_achievement_awards";
create policy "authenticated select access" on "public"."profile_achievement_awards"
  as permissive for select to "authenticated"
  using ((((profile_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."profile_achievement_awards"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.profile_achievement_unlock_views
drop policy "own achievement unlock views insert" on "public"."profile_achievement_unlock_views";
drop policy "own achievement unlock views select" on "public"."profile_achievement_unlock_views";
drop policy "own achievement unlock views update" on "public"."profile_achievement_unlock_views";
drop policy "permanent accounts only" on "public"."profile_achievement_unlock_views";
create policy "own achievement unlock views insert" on "public"."profile_achievement_unlock_views"
  as permissive for insert to "authenticated"
  with check (((profile_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "own achievement unlock views select" on "public"."profile_achievement_unlock_views"
  as permissive for select to "authenticated"
  using (((profile_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "own achievement unlock views update" on "public"."profile_achievement_unlock_views"
  as permissive for update to "authenticated"
  using (((profile_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((profile_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."profile_achievement_unlock_views"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.profiles
drop policy "Staff can view profiles" on "public"."profiles";
drop policy "Users can insert own profile" on "public"."profiles";
drop policy "Users can update own profile" on "public"."profiles";
drop policy "Users can view own profile" on "public"."profiles";
drop policy "permanent accounts only" on "public"."profiles";
drop policy "staff admins update profile roles" on "public"."profiles";
create policy "Users can insert own profile" on "public"."profiles"
  as permissive for insert to "authenticated"
  with check ((((( SELECT auth.uid() AS uid) = id) AND (deleted_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."profiles"
  as permissive for select to "authenticated"
  using ((((((select current_staff_role_rank()) >= 20) AND (deleted_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((((( SELECT auth.uid() AS uid) = id) AND (deleted_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "authenticated update access" on "public"."profiles"
  as permissive for update to "authenticated"
  using (((((( SELECT auth.uid() AS uid) = id) AND (deleted_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((private.is_vrena_admin() AND ((lower(COALESCE(role, ''::text)) <> 'owner'::text) OR private.is_vrena_owner()))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))))
  with check (((((( SELECT auth.uid() AS uid) = id) AND (deleted_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((private.is_vrena_admin() AND ((lower(COALESCE(role, ''::text)) <> 'owner'::text) OR private.is_vrena_owner()))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."profiles"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.push_events
drop policy "permanent accounts only" on "public"."push_events";
drop policy "users read own push events" on "public"."push_events";
create policy "permanent accounts only" on "public"."push_events"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users read own push events" on "public"."push_events"
  as permissive for select to "authenticated"
  using ((((select auth.uid()) = recipient_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.push_subscriptions
drop policy "permanent accounts only" on "public"."push_subscriptions";
drop policy "users create own push subscriptions" on "public"."push_subscriptions";
drop policy "users delete own push subscriptions" on "public"."push_subscriptions";
drop policy "users read own push subscriptions" on "public"."push_subscriptions";
drop policy "users update own push subscriptions" on "public"."push_subscriptions";
create policy "permanent accounts only" on "public"."push_subscriptions"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users create own push subscriptions" on "public"."push_subscriptions"
  as permissive for insert to "authenticated"
  with check ((((( SELECT auth.uid() AS uid) = profile_id) AND ((lower(endpoint) ~ '^https://fcm[.]googleapis[.]com/'::text) OR (lower(endpoint) ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'::text) OR (lower(endpoint) ~ '^https://web[.]push[.]apple[.]com/'::text) OR (lower(endpoint) ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'::text)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users delete own push subscriptions" on "public"."push_subscriptions"
  as permissive for delete to "authenticated"
  using ((((select auth.uid()) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users read own push subscriptions" on "public"."push_subscriptions"
  as permissive for select to "authenticated"
  using ((((select auth.uid()) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users update own push subscriptions" on "public"."push_subscriptions"
  as permissive for update to "authenticated"
  using (((( SELECT auth.uid() AS uid) = profile_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((( SELECT auth.uid() AS uid) = profile_id) AND ((lower(endpoint) ~ '^https://fcm[.]googleapis[.]com/'::text) OR (lower(endpoint) ~ '^https://updates[.]push[.]services[.]mozilla[.]com/'::text) OR (lower(endpoint) ~ '^https://web[.]push[.]apple[.]com/'::text) OR (lower(endpoint) ~ '^https://([a-z0-9-]+[.])*notify[.]windows[.]com/'::text)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.session_invites
drop policy "invite owners can delete invites" on "public"."session_invites";
drop policy "invited users update their invites" on "public"."session_invites";
drop policy "permanent accounts only" on "public"."session_invites";
drop policy "session invites readable by related users" on "public"."session_invites";
drop policy "users create own invites" on "public"."session_invites";
create policy "invite owners can delete invites" on "public"."session_invites"
  as permissive for delete to "authenticated"
  using ((((inviter_id = ( SELECT auth.uid() AS uid)) OR (recipient_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "invited users update their invites" on "public"."session_invites"
  as permissive for update to "authenticated"
  using (((recipient_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((recipient_id = ( SELECT auth.uid() AS uid))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."session_invites"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "session invites readable by related users" on "public"."session_invites"
  as permissive for select to "authenticated"
  using ((((inviter_id = ( SELECT auth.uid() AS uid)) OR (recipient_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users create own invites" on "public"."session_invites"
  as permissive for insert to "authenticated"
  with check ((((inviter_id = ( SELECT auth.uid() AS uid)) AND (private.can_manage_session_row(session_id) OR (EXISTS ( SELECT 1
   FROM session_participants sp
  WHERE ((sp.session_id = session_invites.session_id) AND (sp.profile_id = ( SELECT auth.uid() AS uid)) AND (sp.deleted_at IS NULL))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.session_messages
drop policy "aal2 admins read session messages" on "public"."session_messages";
drop policy "admins delete session messages" on "public"."session_messages";
drop policy "authors delete own messages" on "public"."session_messages";
drop policy "permanent accounts only" on "public"."session_messages";
drop policy "session creators and admins review messages" on "public"."session_messages";
drop policy "session messages are readable" on "public"."session_messages";
create policy "authenticated delete access" on "public"."session_messages"
  as permissive for delete to "authenticated"
  using ((((COALESCE(( SELECT current_staff_role_rank() AS current_staff_role_rank), 0) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((((select auth.uid()) = author_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "authenticated select access" on "public"."session_messages"
  as permissive for select to "authenticated"
  using ((((COALESCE(( SELECT current_staff_role_rank() AS current_staff_role_rank), 0) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((((moderation_status = 'approved'::text) AND private.can_view_session_row(session_id)) OR (author_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = session_messages.session_id) AND (sessions.owner_id = ( SELECT auth.uid() AS uid))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."session_messages"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "session creators and admins review messages" on "public"."session_messages"
  as permissive for update to "authenticated"
  using ((((EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = session_messages.session_id) AND (sessions.owner_id = ( SELECT auth.uid() AS uid))))) OR (COALESCE(( SELECT current_staff_role_rank() AS current_staff_role_rank), 0) >= 100))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((EXISTS ( SELECT 1
   FROM sessions
  WHERE ((sessions.id = session_messages.session_id) AND (sessions.owner_id = ( SELECT auth.uid() AS uid))))) OR (COALESCE(( SELECT current_staff_role_rank() AS current_staff_role_rank), 0) >= 100))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.session_participant_chapter_times
drop policy "chapter times select own or staff" on "public"."session_participant_chapter_times";
drop policy "chapter times staff delete" on "public"."session_participant_chapter_times";
drop policy "chapter times staff insert" on "public"."session_participant_chapter_times";
drop policy "chapter times staff update" on "public"."session_participant_chapter_times";
drop policy "permanent accounts only" on "public"."session_participant_chapter_times";
create policy "chapter times select own or staff" on "public"."session_participant_chapter_times"
  as permissive for select to "authenticated"
  using ((((profile_id = (select auth.uid())) OR private.is_staff_console_user(20))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "chapter times staff delete" on "public"."session_participant_chapter_times"
  as permissive for delete to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "chapter times staff insert" on "public"."session_participant_chapter_times"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "chapter times staff update" on "public"."session_participant_chapter_times"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "permanent accounts only" on "public"."session_participant_chapter_times"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.session_participants
drop policy "permanent accounts only" on "public"."session_participants";
drop policy "session managers update participant results" on "public"."session_participants";
drop policy "session participants readable by related users" on "public"."session_participants";
drop policy "users join allowed sessions as themselves" on "public"."session_participants";
create policy "permanent accounts only" on "public"."session_participants"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "session managers update participant results" on "public"."session_participants"
  as permissive for update to "authenticated"
  using ((((deleted_at IS NULL) AND private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((deleted_at IS NULL) AND private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "session participants readable by related users" on "public"."session_participants"
  as permissive for select to "authenticated"
  using ((((deleted_at IS NULL) AND ((profile_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_session_row(session_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users join allowed sessions as themselves" on "public"."session_participants"
  as permissive for insert to "authenticated"
  with check ((((profile_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL) AND private.can_join_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.session_waitlist
drop policy "permanent accounts only" on "public"."session_waitlist";
drop policy "users can join their own waitlist" on "public"."session_waitlist";
drop policy "users can leave their own waitlist" on "public"."session_waitlist";
drop policy "waitlist readable by allowed users" on "public"."session_waitlist";
create policy "permanent accounts only" on "public"."session_waitlist"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users can join their own waitlist" on "public"."session_waitlist"
  as permissive for insert to "authenticated"
  with check ((((profile_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = session_waitlist.session_id) AND (s.deleted_at IS NULL) AND (s.status = 'open'::text) AND ((s.visibility = 'public'::text) OR (s.owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM session_invites si
          WHERE ((si.session_id = s.id) AND (si.recipient_id = ( SELECT auth.uid() AS uid))))))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users can leave their own waitlist" on "public"."session_waitlist"
  as permissive for delete to "authenticated"
  using ((((profile_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "waitlist readable by allowed users" on "public"."session_waitlist"
  as permissive for select to "authenticated"
  using ((((profile_id = ( SELECT auth.uid() AS uid)) OR private.can_manage_session_row(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.sessions
drop policy "participants update session votes" on "public"."sessions";
drop policy "permanent accounts only" on "public"."sessions";
drop policy "session managers update sessions" on "public"."sessions";
drop policy "sessions readable by allowed users" on "public"."sessions";
drop policy "users create own community sessions" on "public"."sessions";
create policy "authenticated update access" on "public"."sessions"
  as permissive for update to "authenticated"
  using ((((EXISTS ( SELECT 1
   FROM session_participants sp
  WHERE ((sp.session_id = sessions.id) AND (sp.profile_id = ( SELECT auth.uid() AS uid)) AND (sp.deleted_at IS NULL))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_manage_session_row(id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))))
  with check ((((EXISTS ( SELECT 1
   FROM session_participants sp
  WHERE ((sp.session_id = sessions.id) AND (sp.profile_id = ( SELECT auth.uid() AS uid)) AND (sp.deleted_at IS NULL))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_manage_session_row(id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."sessions"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "sessions readable by allowed users" on "public"."sessions"
  as permissive for select to "authenticated"
  using ((private.can_view_session_row(id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users create own community sessions" on "public"."sessions"
  as permissive for insert to "authenticated"
  with check ((((owner_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE((( SELECT ((select auth.jwt()) ->> 'is_anonymous'::text)))::boolean, false)) AND (deleted_at IS NULL) AND (status = 'open'::text) AND (booking_type = 'community'::text) AND (ticket_type IS NULL) AND (ticket_player_count IS NULL) AND (ticket_total_price IS NULL) AND (ticket_unit_price IS NULL) AND (ticket_status IS NULL) AND (ticket_reference IS NULL) AND (ticket_customer_id IS NULL) AND (challenge_target_id IS NULL) AND (challenge_status IS NULL) AND (challenge_accepted_at IS NULL) AND (challenge_declined_at IS NULL) AND ((club_id IS NULL) OR (COALESCE((select current_staff_role_rank()), 0) >= 50) OR (EXISTS ( SELECT 1
   FROM clubs c
  WHERE ((c.id = sessions.club_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM club_members cm
  WHERE ((cm.club_id = sessions.club_id) AND (cm.profile_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'approved'::text) AND (cm.deleted_at IS NULL))))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_attendance_approvals
drop policy "permanent accounts only" on "public"."staff_attendance_approvals";
drop policy "staff attendance approvals read" on "public"."staff_attendance_approvals";
create policy "permanent accounts only" on "public"."staff_attendance_approvals"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff attendance approvals read" on "public"."staff_attendance_approvals"
  as permissive for select to "authenticated"
  using ((((select current_staff_role_rank()) >= 20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_attendance_logs
drop policy "permanent accounts only" on "public"."staff_attendance_logs";
drop policy "staff attendance logs manage" on "public"."staff_attendance_logs";
drop policy "staff attendance logs read" on "public"."staff_attendance_logs";
create policy "authenticated select access" on "public"."staff_attendance_logs"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((( SELECT private.can_read_staff_attendance_row(staff_attendance_logs.staff_profile_id) AS can_read_staff_attendance_row)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_attendance_logs"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff attendance logs manage" on "public"."staff_attendance_logs"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff attendance logs manage delete" on "public"."staff_attendance_logs"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff attendance logs manage insert" on "public"."staff_attendance_logs"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_attendance_settings
drop policy "permanent accounts only" on "public"."staff_attendance_settings";
drop policy "staff attendance settings manage" on "public"."staff_attendance_settings";
drop policy "staff attendance settings read" on "public"."staff_attendance_settings";
create policy "authenticated select access" on "public"."staff_attendance_settings"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((( SELECT private.can_read_staff_attendance_settings() AS can_read_staff_attendance_settings)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_attendance_settings"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff attendance settings manage" on "public"."staff_attendance_settings"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff attendance settings manage delete" on "public"."staff_attendance_settings"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff attendance settings manage insert" on "public"."staff_attendance_settings"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_check_in_locations
drop policy "permanent accounts only" on "public"."staff_check_in_locations";
drop policy "staff check in locations manage" on "public"."staff_check_in_locations";
create policy "permanent accounts only" on "public"."staff_check_in_locations"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff check in locations manage" on "public"."staff_check_in_locations"
  as permissive for all to "authenticated"
  using ((((select current_staff_role_rank()) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((select current_staff_role_rank()) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_cost_assignments
drop policy "HR administrators cancel cost assignments" on "public"."staff_cost_assignments";
drop policy "HR administrators create cost assignments" on "public"."staff_cost_assignments";
drop policy "HR administrators read cost assignments" on "public"."staff_cost_assignments";
create policy "HR administrators cancel cost assignments" on "public"."staff_cost_assignments"
  as permissive for update to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator) AND (NOT COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false)) AND (cancelled_at IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((( SELECT private.is_hr_administrator() AS is_hr_administrator) AND (NOT COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false)) AND (cancelled_at IS NOT NULL) AND (cancelled_by = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "HR administrators create cost assignments" on "public"."staff_cost_assignments"
  as permissive for insert to "authenticated"
  with check (((( SELECT private.is_hr_administrator() AS is_hr_administrator) AND (NOT COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false)) AND (created_by = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)) AND (cancelled_at IS NULL) AND (cancelled_by IS NULL))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "HR administrators read cost assignments" on "public"."staff_cost_assignments"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator) AND (NOT COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_discount_rules
drop policy "permanent accounts only" on "public"."staff_discount_rules";
drop policy "staff discounts insert" on "public"."staff_discount_rules";
drop policy "staff discounts select" on "public"."staff_discount_rules";
drop policy "staff discounts update" on "public"."staff_discount_rules";
create policy "permanent accounts only" on "public"."staff_discount_rules"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff discounts insert" on "public"."staff_discount_rules"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff discounts select" on "public"."staff_discount_rules"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff discounts update" on "public"."staff_discount_rules"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_employee_profiles
drop policy "permanent accounts only" on "public"."staff_employee_profiles";
drop policy "staff employee profiles manage" on "public"."staff_employee_profiles";
drop policy "staff employee profiles read" on "public"."staff_employee_profiles";
create policy "authenticated select access" on "public"."staff_employee_profiles"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((( SELECT private.is_hr_administrator() AS is_hr_administrator) OR (profile_id = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_employee_profiles"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff employee profiles manage" on "public"."staff_employee_profiles"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff employee profiles manage delete" on "public"."staff_employee_profiles"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff employee profiles manage insert" on "public"."staff_employee_profiles"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_games
drop policy "permanent accounts only" on "public"."staff_games";
drop policy "staff games active public select" on "public"."staff_games";
drop policy "staff games insert" on "public"."staff_games";
drop policy "staff games select" on "public"."staff_games";
drop policy "staff games update" on "public"."staff_games";
create policy "authenticated select access" on "public"."staff_games"
  as permissive for select to "authenticated"
  using ((((active = true)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_games"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff games active public select anon" on "public"."staff_games"
  as permissive for select to "anon"
  using ((active = true));
create policy "staff games insert" on "public"."staff_games"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff games update" on "public"."staff_games"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_hr_adjustments
drop policy "permanent accounts only" on "public"."staff_hr_adjustments";
drop policy "staff hr adjustments manage" on "public"."staff_hr_adjustments";
drop policy "staff hr adjustments read" on "public"."staff_hr_adjustments";
create policy "authenticated select access" on "public"."staff_hr_adjustments"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((( SELECT private.is_hr_administrator() AS is_hr_administrator) OR (profile_id = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_hr_adjustments"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff hr adjustments manage" on "public"."staff_hr_adjustments"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr adjustments manage delete" on "public"."staff_hr_adjustments"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr adjustments manage insert" on "public"."staff_hr_adjustments"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_hr_documents
drop policy "permanent accounts only" on "public"."staff_hr_documents";
drop policy "staff hr documents manage" on "public"."staff_hr_documents";
drop policy "staff hr documents read" on "public"."staff_hr_documents";
create policy "authenticated select access" on "public"."staff_hr_documents"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((( SELECT private.is_hr_administrator() AS is_hr_administrator) OR (profile_id = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_hr_documents"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff hr documents manage" on "public"."staff_hr_documents"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr documents manage delete" on "public"."staff_hr_documents"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr documents manage insert" on "public"."staff_hr_documents"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_hr_policy_versions
drop policy "staff hr policy read" on "public"."staff_hr_policy_versions";
create policy "staff hr policy read" on "public"."staff_hr_policy_versions"
  as permissive for select to "authenticated"
  using ((((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)) AND ( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_hr_settings
drop policy "permanent accounts only" on "public"."staff_hr_settings";
drop policy "staff hr settings manage" on "public"."staff_hr_settings";
drop policy "staff hr settings read" on "public"."staff_hr_settings";
create policy "authenticated select access" on "public"."staff_hr_settings"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_hr_settings"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff hr settings manage" on "public"."staff_hr_settings"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr settings manage delete" on "public"."staff_hr_settings"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr settings manage insert" on "public"."staff_hr_settings"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_hr_setup_options
drop policy "permanent accounts only" on "public"."staff_hr_setup_options";
drop policy "staff hr setup manage" on "public"."staff_hr_setup_options";
drop policy "staff hr setup read" on "public"."staff_hr_setup_options";
create policy "authenticated select access" on "public"."staff_hr_setup_options"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_hr_setup_options"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff hr setup manage" on "public"."staff_hr_setup_options"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr setup manage delete" on "public"."staff_hr_setup_options"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff hr setup manage insert" on "public"."staff_hr_setup_options"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_leave_requests
drop policy "permanent accounts only" on "public"."staff_leave_requests";
drop policy "staff leave manage" on "public"."staff_leave_requests";
drop policy "staff leave read" on "public"."staff_leave_requests";
create policy "authenticated select access" on "public"."staff_leave_requests"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((( SELECT private.can_read_staff_attendance_row(staff_leave_requests.staff_profile_id) AS can_read_staff_attendance_row)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_leave_requests"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff leave manage" on "public"."staff_leave_requests"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff leave manage delete" on "public"."staff_leave_requests"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff leave manage insert" on "public"."staff_leave_requests"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_loyalty_rules
drop policy "permanent accounts only" on "public"."staff_loyalty_rules";
drop policy "staff loyalty insert" on "public"."staff_loyalty_rules";
drop policy "staff loyalty select" on "public"."staff_loyalty_rules";
drop policy "staff loyalty update" on "public"."staff_loyalty_rules";
create policy "permanent accounts only" on "public"."staff_loyalty_rules"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff loyalty insert" on "public"."staff_loyalty_rules"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff loyalty select" on "public"."staff_loyalty_rules"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff loyalty update" on "public"."staff_loyalty_rules"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_order_payments
drop policy "permanent accounts only" on "public"."staff_order_payments";
drop policy "staff order payments delete" on "public"."staff_order_payments";
drop policy "staff order payments insert" on "public"."staff_order_payments";
drop policy "staff order payments select" on "public"."staff_order_payments";
drop policy "staff order payments update" on "public"."staff_order_payments";
create policy "permanent accounts only" on "public"."staff_order_payments"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff order payments delete" on "public"."staff_order_payments"
  as permissive for delete to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff order payments insert" on "public"."staff_order_payments"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff order payments select" on "public"."staff_order_payments"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff order payments update" on "public"."staff_order_payments"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_orders
drop policy "permanent accounts only" on "public"."staff_orders";
drop policy "staff orders insert" on "public"."staff_orders";
drop policy "staff orders select" on "public"."staff_orders";
drop policy "staff orders update" on "public"."staff_orders";
create policy "permanent accounts only" on "public"."staff_orders"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff orders insert" on "public"."staff_orders"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff orders select" on "public"."staff_orders"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff orders update" on "public"."staff_orders"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(50)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_payroll_items
drop policy "permanent accounts only" on "public"."staff_payroll_items";
drop policy "staff payroll items manage" on "public"."staff_payroll_items";
drop policy "staff payroll items read" on "public"."staff_payroll_items";
create policy "authenticated select access" on "public"."staff_payroll_items"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((( SELECT private.is_hr_administrator() AS is_hr_administrator) OR (profile_id = ( SELECT current_staff_actor_profile_id() AS current_staff_actor_profile_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_payroll_items"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff payroll items manage" on "public"."staff_payroll_items"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll items manage delete" on "public"."staff_payroll_items"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll items manage insert" on "public"."staff_payroll_items"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_payroll_runs
drop policy "permanent accounts only" on "public"."staff_payroll_runs";
drop policy "staff payroll runs manage" on "public"."staff_payroll_runs";
drop policy "staff payroll runs read" on "public"."staff_payroll_runs";
create policy "authenticated select access" on "public"."staff_payroll_runs"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_payroll_runs"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff payroll runs manage" on "public"."staff_payroll_runs"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll runs manage delete" on "public"."staff_payroll_runs"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll runs manage insert" on "public"."staff_payroll_runs"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_payroll_source_snapshots
drop policy "staff payroll source snapshots delete" on "public"."staff_payroll_source_snapshots";
drop policy "staff payroll source snapshots insert" on "public"."staff_payroll_source_snapshots";
drop policy "staff payroll source snapshots read" on "public"."staff_payroll_source_snapshots";
drop policy "staff payroll source snapshots update" on "public"."staff_payroll_source_snapshots";
create policy "staff payroll source snapshots delete" on "public"."staff_payroll_source_snapshots"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll source snapshots insert" on "public"."staff_payroll_source_snapshots"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll source snapshots read" on "public"."staff_payroll_source_snapshots"
  as permissive for select to "authenticated"
  using ((((NOT COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false)) AND ( SELECT private.is_hr_administrator() AS is_hr_administrator))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff payroll source snapshots update" on "public"."staff_payroll_source_snapshots"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_hr_administrator() AS is_hr_administrator)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_pricing_rules
drop policy "permanent accounts only" on "public"."staff_pricing_rules";
drop policy "staff prices insert" on "public"."staff_pricing_rules";
drop policy "staff prices select" on "public"."staff_pricing_rules";
drop policy "staff prices update" on "public"."staff_pricing_rules";
create policy "permanent accounts only" on "public"."staff_pricing_rules"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff prices insert" on "public"."staff_pricing_rules"
  as permissive for insert to "authenticated"
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff prices select" on "public"."staff_pricing_rules"
  as permissive for select to "authenticated"
  using ((private.is_staff_console_user(20)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff prices update" on "public"."staff_pricing_rules"
  as permissive for update to "authenticated"
  using ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.is_staff_console_user(80)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_schedule_shifts
drop policy "permanent accounts only" on "public"."staff_schedule_shifts";
drop policy "staff shifts manage" on "public"."staff_schedule_shifts";
drop policy "staff shifts read" on "public"."staff_schedule_shifts";
create policy "authenticated select access" on "public"."staff_schedule_shifts"
  as permissive for select to "authenticated"
  using (((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((( SELECT private.can_read_staff_attendance_row(staff_schedule_shifts.staff_profile_id) AS can_read_staff_attendance_row)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."staff_schedule_shifts"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff shifts manage" on "public"."staff_schedule_shifts"
  as permissive for update to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff shifts manage delete" on "public"."staff_schedule_shifts"
  as permissive for delete to "authenticated"
  using ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "staff shifts manage insert" on "public"."staff_schedule_shifts"
  as permissive for insert to "authenticated"
  with check ((( SELECT private.is_staff_attendance_editor() AS is_staff_attendance_editor)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.staff_zalo_settings
drop policy "permanent accounts only" on "public"."staff_zalo_settings";
drop policy "staff zalo settings manage" on "public"."staff_zalo_settings";
create policy "permanent accounts only" on "public"."staff_zalo_settings"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "staff zalo settings manage" on "public"."staff_zalo_settings"
  as permissive for all to "authenticated"
  using ((((select current_staff_role_rank()) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((select current_staff_role_rank()) >= 100)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.tournament_audit_log
drop policy "Tournament managers read audit history" on "public"."tournament_audit_log";
create policy "Tournament managers read audit history" on "public"."tournament_audit_log"
  as permissive for select to "authenticated"
  using ((((( SELECT auth.uid() AS uid) IS NOT NULL) AND (NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)) AND private.can_manage_tournament(session_id))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.tournament_editors
drop policy "Tournament editors are readable" on "public"."tournament_editors";
drop policy "Tournament editors host insert" on "public"."tournament_editors";
drop policy "Tournament owners manage editors" on "public"."tournament_editors";
drop policy "permanent accounts only" on "public"."tournament_editors";
create policy "Tournament owners manage editors" on "public"."tournament_editors"
  as permissive for update to "authenticated"
  using ((private.owns_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.owns_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament owners manage editors delete" on "public"."tournament_editors"
  as permissive for delete to "authenticated"
  using ((private.owns_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated insert access" on "public"."tournament_editors"
  as permissive for insert to "authenticated"
  with check ((((EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = tournament_editors.session_id) AND (s.owner_id = (select auth.uid())))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.owns_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "authenticated select access" on "public"."tournament_editors"
  as permissive for select to "authenticated"
  using (((private.owns_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_view_session_row(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_editors"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.tournament_matches
drop policy "Tournament managers write matches" on "public"."tournament_matches";
drop policy "Tournament matches are readable" on "public"."tournament_matches";
drop policy "permanent accounts only" on "public"."tournament_matches";
create policy "Tournament managers write matches" on "public"."tournament_matches"
  as permissive for update to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write matches delete" on "public"."tournament_matches"
  as permissive for delete to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write matches insert" on "public"."tournament_matches"
  as permissive for insert to "authenticated"
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."tournament_matches"
  as permissive for select to "authenticated"
  using (((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_view_session_row(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_matches"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.tournament_pool_entries
drop policy "Tournament entries are readable" on "public"."tournament_pool_entries";
drop policy "Tournament managers write entries" on "public"."tournament_pool_entries";
drop policy "permanent accounts only" on "public"."tournament_pool_entries";
create policy "Tournament managers write entries" on "public"."tournament_pool_entries"
  as permissive for update to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write entries delete" on "public"."tournament_pool_entries"
  as permissive for delete to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write entries insert" on "public"."tournament_pool_entries"
  as permissive for insert to "authenticated"
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."tournament_pool_entries"
  as permissive for select to "authenticated"
  using (((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_view_session_row(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_pool_entries"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.tournament_pools
drop policy "Tournament data is readable" on "public"."tournament_pools";
drop policy "Tournament managers write pools" on "public"."tournament_pools";
drop policy "permanent accounts only" on "public"."tournament_pools";
create policy "Tournament managers write pools" on "public"."tournament_pools"
  as permissive for update to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write pools delete" on "public"."tournament_pools"
  as permissive for delete to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write pools insert" on "public"."tournament_pools"
  as permissive for insert to "authenticated"
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."tournament_pools"
  as permissive for select to "authenticated"
  using (((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_view_session_row(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_pools"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.tournament_team_members
drop policy "Tournament managers write team members" on "public"."tournament_team_members";
drop policy "Tournament team members are readable" on "public"."tournament_team_members";
drop policy "permanent accounts only" on "public"."tournament_team_members";
create policy "Tournament managers write team members" on "public"."tournament_team_members"
  as permissive for update to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM tournament_teams tt
  WHERE ((tt.id = tournament_team_members.team_id) AND private.can_manage_tournament(tt.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check (((EXISTS ( SELECT 1
   FROM tournament_teams tt
  WHERE ((tt.id = tournament_team_members.team_id) AND private.can_manage_tournament(tt.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write team members delete" on "public"."tournament_team_members"
  as permissive for delete to "authenticated"
  using (((EXISTS ( SELECT 1
   FROM tournament_teams tt
  WHERE ((tt.id = tournament_team_members.team_id) AND private.can_manage_tournament(tt.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write team members insert" on "public"."tournament_team_members"
  as permissive for insert to "authenticated"
  with check (((EXISTS ( SELECT 1
   FROM tournament_teams tt
  WHERE ((tt.id = tournament_team_members.team_id) AND private.can_manage_tournament(tt.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."tournament_team_members"
  as permissive for select to "authenticated"
  using ((((EXISTS ( SELECT 1
   FROM tournament_teams tt
  WHERE ((tt.id = tournament_team_members.team_id) AND private.can_manage_tournament(tt.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or (((EXISTS ( SELECT 1
   FROM tournament_teams team
  WHERE ((team.id = tournament_team_members.team_id) AND private.can_view_session_row(team.session_id))))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_team_members"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.tournament_teams
drop policy "Tournament managers write teams" on "public"."tournament_teams";
drop policy "Tournament teams are readable" on "public"."tournament_teams";
drop policy "permanent accounts only" on "public"."tournament_teams";
create policy "Tournament managers write teams" on "public"."tournament_teams"
  as permissive for update to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write teams delete" on "public"."tournament_teams"
  as permissive for delete to "authenticated"
  using ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "Tournament managers write teams insert" on "public"."tournament_teams"
  as permissive for insert to "authenticated"
  with check ((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "authenticated select access" on "public"."tournament_teams"
  as permissive for select to "authenticated"
  using (((private.can_manage_tournament(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((private.can_view_session_row(session_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."tournament_teams"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));

-- public.user_follows
drop policy "follows are readable" on "public"."user_follows";
drop policy "permanent accounts only" on "public"."user_follows";
drop policy "users manage own follows" on "public"."user_follows";
create policy "authenticated select access" on "public"."user_follows"
  as permissive for select to "authenticated"
  using (((true) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))) or ((((select auth.uid()) = follower_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))));
create policy "permanent accounts only" on "public"."user_follows"
  as restrictive for all to "authenticated"
  using ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)))
  with check ((NOT COALESCE(( SELECT (((select auth.jwt()) ->> 'is_anonymous'::text))::boolean AS bool), false)));
create policy "users manage own follows" on "public"."user_follows"
  as permissive for update to "authenticated"
  using ((((select auth.uid()) = follower_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)))
  with check ((((select auth.uid()) = follower_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users manage own follows delete" on "public"."user_follows"
  as permissive for delete to "authenticated"
  using ((((select auth.uid()) = follower_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));
create policy "users manage own follows insert" on "public"."user_follows"
  as permissive for insert to "authenticated"
  with check ((((select auth.uid()) = follower_id)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.venue_game_results
drop policy "venue results visible to player or session viewers" on "public"."venue_game_results";
create policy "venue results visible to player or session viewers" on "public"."venue_game_results"
  as permissive for select to "authenticated"
  using ((((profile_id = ( SELECT auth.uid() AS uid)) OR ((matched_session_id IS NOT NULL) AND can_view_session_row(matched_session_id)))) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

-- public.vouchers
drop policy "Public can read active vouchers" on "public"."vouchers";
create policy "Public can read active vouchers anon" on "public"."vouchers"
  as permissive for select to "anon"
  using ((active = true));
create policy "Public can read active vouchers authenticated" on "public"."vouchers"
  as permissive for select to "authenticated"
  using (((active = true)) and ((select auth.uid()) is not null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)));

notify pgrst, 'reload schema';
commit;
