-- Cross-account operations use disposable fixtures and always roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email) values
  ('8d000000-0000-4000-8000-000000000001', 'idor-recipient@example.invalid'),
  ('8d000000-0000-4000-8000-000000000002', 'idor-private-owner@example.invalid'),
  ('8d000000-0000-4000-8000-000000000003', 'idor-inviter@example.invalid');
insert into public.profiles (id, full_name, role) values
  ('8d000000-0000-4000-8000-000000000001', 'IDOR Recipient', 'player'),
  ('8d000000-0000-4000-8000-000000000002', 'IDOR Private Owner', 'player'),
  ('8d000000-0000-4000-8000-000000000003', 'IDOR Inviter', 'player')
on conflict (id) do update set role = excluded.role;
insert into public.sessions (id, owner_id, name, date, start_time, max_players, visibility, invite_code, booking_type)
values
  ('8d000000-0000-4000-8000-000000000011', '8d000000-0000-4000-8000-000000000003', 'IDOR invited fixture', current_date + 10, '10:00', 4, 'private', 'IDOR-INVITED', 'community'),
  ('8d000000-0000-4000-8000-000000000012', '8d000000-0000-4000-8000-000000000002', 'IDOR unrelated fixture', current_date + 10, '11:00', 4, 'private', 'IDOR-PRIVATE', 'community');
insert into public.session_invites (id, session_id, inviter_id, recipient_id, recipient_display_name, status)
values ('8d000000-0000-4000-8000-000000000021', '8d000000-0000-4000-8000-000000000011', '8d000000-0000-4000-8000-000000000003', '8d000000-0000-4000-8000-000000000001', 'IDOR Recipient', 'pending');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
select is((select count(*) from public.sessions where id = '8d000000-0000-4000-8000-000000000011'), 1::bigint,
  'the intended recipient can read the invited session');
select is((select count(*) from public.sessions where id = '8d000000-0000-4000-8000-000000000012'), 0::bigint,
  'the recipient cannot read an unrelated private session');
select lives_ok($$update public.session_invites set status = 'accepted' where id = '8d000000-0000-4000-8000-000000000021'$$,
  'the recipient can accept their invitation');
select is((select status from public.session_invites where id = '8d000000-0000-4000-8000-000000000021'), 'accepted',
  'legitimate acceptance is persisted');
select throws_ok($$update public.session_invites set session_id = '8d000000-0000-4000-8000-000000000012' where id = '8d000000-0000-4000-8000-000000000021'$$,
  '42501', null, 'an invitation cannot be retargeted to another private session');
select is((select count(*) from public.sessions where id = '8d000000-0000-4000-8000-000000000012'), 0::bigint,
  'the unrelated private session remains unreadable after the retarget attempt');
select throws_ok($$update public.session_invites set inviter_id = '8d000000-0000-4000-8000-000000000002' where id = '8d000000-0000-4000-8000-000000000021'$$,
  '42501', null, 'the recipient cannot forge a different inviter');
select throws_ok($$update public.session_invites set recipient_id = '8d000000-0000-4000-8000-000000000002' where id = '8d000000-0000-4000-8000-000000000021'$$,
  '42501', null, 'the recipient cannot reassign the invitation');
select throws_ok($$update public.session_invites set id = '8d000000-0000-4000-8000-000000000099' where id = '8d000000-0000-4000-8000-000000000021'$$,
  '42501', null, 'the invitation record identity is immutable');
select is((select session_id::text from public.session_invites where id = '8d000000-0000-4000-8000-000000000021'),
  '8d000000-0000-4000-8000-000000000011', 'the original session binding is preserved');
select lives_ok($$update public.session_invites set status = 'declined' where id = '8d000000-0000-4000-8000-000000000021'$$,
  'the recipient can still decline their invitation');

select set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
select results_eq($$update public.session_invites set status = 'accepted' where id = '8d000000-0000-4000-8000-000000000021' returning id$$,
  $$select null::uuid where false$$, 'an unrelated account cannot respond to the invitation');
select results_eq($$delete from public.session_invites where id = '8d000000-0000-4000-8000-000000000021' returning id$$,
  $$select null::uuid where false$$, 'an unrelated account cannot delete the invitation');

select set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.session_invites where id = '8d000000-0000-4000-8000-000000000021'), 0::bigint,
  'an anonymous Auth identity cannot read the invitation');

select set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
select results_eq($$delete from public.session_invites where id = '8d000000-0000-4000-8000-000000000021' returning id$$,
  $$values ('8d000000-0000-4000-8000-000000000021'::uuid)$$, 'the recipient can delete their own invitation');
select * from finish();
rollback;
