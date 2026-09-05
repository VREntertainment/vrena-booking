begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_table_privilege(role_name,'private.guest_ticket_claim_context','SELECT,INSERT,UPDATE,DELETE'),
  format('%s cannot read or forge a claim authorization',role_name))
from unnest(array['anon','authenticated','service_role']) role_name;
select ok(not has_function_privilege(role_name,'private.is_authorized_guest_ticket_claim(public.sessions,public.sessions)','EXECUTE'),
  format('%s cannot invoke the internal claim-context helper',role_name))
from unnest(array['anon','authenticated','service_role']) role_name;
select ok((select relrowsecurity from pg_class where oid='private.guest_ticket_claim_context'::regclass),
  'claim context has RLS enabled in its unexposed schema');

create temporary table claim_context_rows (kind text, value public.sessions);
insert into claim_context_rows values ('old',jsonb_populate_record(null::public.sessions,'{
  "id":"8a000000-0000-4000-8000-000000000001",
  "owner_id":"8a000000-0000-4000-8000-000000000002",
  "ticket_customer_id":"8a000000-0000-4000-8000-000000000002",
  "booking_type":"ticket","ticket_status":"confirmed","ticket_total_price":100000,
  "name":"Claim context fixture","date":"2027-01-01","require_payment":true,
  "game_votes":{"8a000000-0000-4000-8000-000000000002":"revolta"}
}'::jsonb));
insert into claim_context_rows
select 'new',jsonb_populate_record(value,'{
  "owner_id":"8a000000-0000-4000-8000-000000000003",
  "ticket_customer_id":"8a000000-0000-4000-8000-000000000003",
  "game_votes":{"8a000000-0000-4000-8000-000000000003":"revolta"}
}'::jsonb) from claim_context_rows where kind='old';
select set_config('request.jwt.claims','{"sub":"8a000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',true);
select set_config('app.guest_ticket_claim','true',true);
select is(private.is_authorized_guest_ticket_claim(old.value,new.value),false,
  'a caller-controlled setting cannot authorize a claim')
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';

insert into private.guest_ticket_claim_context
select pg_current_xact_id(),(old.value).id,(new.value).owner_id,(old.value).owner_id,
  (old.value).ticket_customer_id,(new.value).game_votes
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';
select is(private.is_authorized_guest_ticket_claim(old.value,new.value),true,
  'only the exact authorized ownership and vote handoff passes')
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';

select is(private.is_authorized_guest_ticket_claim(old.value,jsonb_populate_record(new.value,change)),false,
  format('claim context cannot authorize an extra change to %s',field))
from claim_context_rows old,claim_context_rows new,
  (values
    ('price','{"ticket_total_price":1}'::jsonb),
    ('status','{"ticket_status":"pending"}'::jsonb),
    ('date','{"date":"2027-01-02"}'::jsonb),
    ('payment requirement','{"require_payment":false}'::jsonb),
    ('name','{"name":"Changed"}'::jsonb),
    ('votes','{"game_votes":{}}'::jsonb),
    ('customer','{"ticket_customer_id":"8a000000-0000-4000-8000-000000000004"}'::jsonb),
    ('session','{"id":"8a000000-0000-4000-8000-000000000005"}'::jsonb)
  ) changes(field,change)
where old.kind='old' and new.kind='new';
update private.guest_ticket_claim_context set transaction_id='1'::xid8;
select is(private.is_authorized_guest_ticket_claim(old.value,new.value),false,
  'authorization from another transaction cannot be reused')
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';
update private.guest_ticket_claim_context set transaction_id=pg_current_xact_id();
select set_config('request.jwt.claims','{"sub":"8a000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',true);
select is(private.is_authorized_guest_ticket_claim(old.value,new.value),false,
  'another account cannot reuse an authorization')
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';
select set_config('request.jwt.claims','{"sub":"8a000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',true);
select is(private.is_authorized_guest_ticket_claim(old.value,new.value),false,
  'an anonymous Auth identity cannot reuse an authorization')
from claim_context_rows old,claim_context_rows new where old.kind='old' and new.kind='new';

select * from finish();
rollback;
