-- Actual Storage row operations supplement the advisory's policy-shape checks.
-- All metadata fixtures roll back; no file uploads or external services run.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select set_config('request.jwt.claims','{"role":"service_role"}',true);

insert into auth.users (id,email) values
 ('89000000-0000-4000-8000-000000000001','storage-notice-owner@example.invalid'),
 ('89000000-0000-4000-8000-000000000002','storage-notice-other@example.invalid');
insert into public.profiles (id,full_name,role) values
 ('89000000-0000-4000-8000-000000000001','Storage notice owner','admin'),
 ('89000000-0000-4000-8000-000000000002','Storage notice other','player')
on conflict (id) do update set role=excluded.role;
insert into auth.mfa_factors (id,user_id,factor_type,status,secret,created_at,updated_at)
values ('89000000-0000-4000-8000-000000000099','89000000-0000-4000-8000-000000000001','totp','verified','LOCAL-TEST-ONLY',now(),now());
insert into public.clubs (id,owner_id,name,visibility)
values ('89000000-0000-4000-8000-000000000003','89000000-0000-4000-8000-000000000001','Storage notice fixture','public');
insert into storage.buckets (id,name)
select bucket,bucket from unnest(array['avatars','club-banners','staff-game-images','staff-hr-documents']) bucket
on conflict (id) do nothing;
insert into storage.objects (bucket_id,name) values
 ('avatars','89000000-0000-4000-8000-000000000001/notice-fixture.png'),
 ('club-banners','89000000-0000-4000-8000-000000000003/notice-fixture.png'),
 ('staff-game-images','notice-fixture.png'),
 ('staff-hr-documents','89000000-0000-4000-8000-000000000001/notice-fixture.pdf');

-- Mirror Storage API transaction context for metadata deletion. RLS remains on;
-- this local-only flag avoids the provider's separate direct-SQL deletion guard.
select set_config('storage.allow_delete_query','true',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"89000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true,"aal":"aal2"}',true);
select is((select count(*) from storage.objects where name like '%notice-fixture%'),0::bigint,
  'anonymous Auth cannot read any of the four buckets, even with matching owner paths');
select throws_ok(format('insert into storage.objects (bucket_id,name) values (%L,%L)',bucket,object_name),'42501',null,
  format('anonymous Auth cannot upload to %s',bucket))
from (values
 ('avatars','89000000-0000-4000-8000-000000000001/notice-fixture-new.png'),
 ('club-banners','89000000-0000-4000-8000-000000000003/notice-fixture-new.png'),
 ('staff-game-images','notice-fixture-new.png'),
 ('staff-hr-documents','89000000-0000-4000-8000-000000000001/notice-fixture-new.pdf')
) objects(bucket,object_name);
select results_eq($$update storage.objects set metadata='{"changed":true}' where name like '%notice-fixture%' returning name$$,
  $$select null::text where false$$,'anonymous Auth cannot update Storage metadata');
select results_eq($$delete from storage.objects where name like '%notice-fixture%' returning name$$,
  $$select null::text where false$$,'anonymous Auth cannot delete Storage objects');

select set_config('request.jwt.claims','{"sub":"89000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"aal":"aal2"}',true);
select is((select count(*) from storage.objects where name like '%notice-fixture%'),4::bigint,
  'the permanent owner and MFA-verified administrator retain their authorized reads');
select lives_ok(format('insert into storage.objects (bucket_id,name) values (%L,%L)',bucket,object_name),
  format('authorized permanent account can upload to %s',bucket))
from (values
 ('avatars','89000000-0000-4000-8000-000000000001/notice-fixture-new.png'),
 ('club-banners','89000000-0000-4000-8000-000000000003/notice-fixture-new.png'),
 ('staff-game-images','notice-fixture-new.png'),
 ('staff-hr-documents','89000000-0000-4000-8000-000000000001/notice-fixture-new.pdf')
) objects(bucket,object_name);
with changed as (update storage.objects set metadata='{"changed":true}' where name like '%notice-fixture%' returning id)
select is((select count(*) from changed),8::bigint,'authorized updates succeed on old and newly uploaded objects');
select throws_ok($$update storage.objects set name='89000000-0000-4000-8000-000000000002/notice-fixture-stolen.png'
  where bucket_id='avatars' and name='89000000-0000-4000-8000-000000000001/notice-fixture.png'$$,
  '42501',null,'an avatar update cannot move an object to another account path');
with removed as (delete from storage.objects where name like '%notice-fixture%' returning id)
select is((select count(*) from removed),8::bigint,'authorized deletion remains available in all four buckets');

select * from finish();
rollback;
