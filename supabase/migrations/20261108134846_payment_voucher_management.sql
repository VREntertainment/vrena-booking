begin;
alter table public.payment_vouchers add column issued_venue_keys text[];
create table private.deleted_payment_vouchers (
 voucher_id uuid primary key, source_order_id uuid not null, source_payment_id uuid not null,
 amount integer not null check(amount>0), deleted_at timestamptz not null default now()
);
create index deleted_payment_vouchers_source_payment on private.deleted_payment_vouchers(source_payment_id);
create index deleted_payment_vouchers_source_order on private.deleted_payment_vouchers(source_order_id);
create table private.payment_voucher_management_requests (
 id uuid primary key, source_order_id uuid not null, signature text not null, response jsonb not null,
 created_at timestamptz not null default now()
);
alter table private.deleted_payment_vouchers enable row level security;
alter table private.payment_voucher_management_requests enable row level security;
revoke all on private.deleted_payment_vouchers,private.payment_voucher_management_requests from public,anon,authenticated;
-- Import previous explicitly authorized mistake deletions without retaining bearer codes.
insert into private.deleted_payment_vouchers(voucher_id,source_order_id,source_payment_id,amount,deleted_at)
select entity_id,(old_value->>'source_order_id')::uuid,(old_value->>'source_payment_id')::uuid,(old_value->>'amount')::integer,created_at
from public.audit_logs where action='payment_voucher_deleted_as_mistake' and old_value->>'source_payment_id' is not null
on conflict(voucher_id) do nothing;

-- Deleted credit is still converted money: prevent reissuing it or replaying an old request.
do $$ declare definition text; begin
 select pg_get_functiondef('private.convert_payment_to_voucher(uuid,uuid,uuid,integer,text,integer,text[])'::regprocedure) into definition;
 if strpos(definition,'select coalesce(sum(amount),0) into used from public.payment_vouchers where source_payment_id=p.id;')=0 or strpos(definition,'coalesce(v.valid_venue_keys,array[v.venue_key]) is distinct from venues')=0 then raise exception 'Inspect changed issuance definition before updating.'; end if;
 definition:=replace(definition,' select * into v from public.payment_vouchers where id=p_request_id;',E' if exists(select 1 from private.deleted_payment_vouchers where voucher_id=p_request_id) then raise exception ''Deleted voucher request cannot be reused.''; end if;\n select * into v from public.payment_vouchers where id=p_request_id;');
 definition:=replace(definition,'coalesce(v.valid_venue_keys,array[v.venue_key]) is distinct from venues','coalesce(v.issued_venue_keys,v.valid_venue_keys,array[v.venue_key]) is distinct from venues');
 definition:=replace(definition,'select coalesce(sum(amount),0) into used from public.payment_vouchers where source_payment_id=p.id;', 'select coalesce((select sum(amount) from public.payment_vouchers where source_payment_id=p.id),0)+coalesce((select sum(amount) from private.deleted_payment_vouchers where source_payment_id=p.id),0) into used;');
 execute definition;
 select pg_get_functiondef('private.guard_voucher_order_refund()'::regprocedure) into definition;
 if strpos(definition,'exists(select 1 from public.payment_vouchers where source_order_id=old.id)')=0 then raise exception 'Inspect changed voucher refund guard.'; end if;
 definition:=replace(definition,'exists(select 1 from public.payment_vouchers where source_order_id=old.id)','(exists(select 1 from public.payment_vouchers where source_order_id=old.id) or exists(select 1 from private.deleted_payment_vouchers where source_order_id=old.id))');
 execute definition;
end $$;

create or replace function private.guard_voucher_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.created_by is null and (new.id,new.order_id,new.payment_method,new.amount,new.created_at) is not distinct from (old.id,old.order_id,old.payment_method,old.amount,old.created_at) then return new; end if;
 if tg_op<>'INSERT' and (old.payment_method in ('voucher','voucher_conversion') or exists(select 1 from public.payment_vouchers where source_payment_id=old.id) or exists(select 1 from private.deleted_payment_vouchers where source_payment_id=old.id)) then raise exception 'Voucher-linked receipts are immutable.'; end if;
 if tg_op<>'DELETE' then
  if new.payment_method='voucher_conversion' and not exists(select 1 from public.payment_vouchers v where v.id=new.id and v.source_order_id=new.order_id and -v.amount=new.amount) then raise exception 'Use the voucher conversion action.'; end if;
  if new.payment_method='voucher' and not exists(select 1 from public.payment_voucher_redemptions r where r.id=new.id and r.order_id=new.order_id and r.amount=new.amount) then raise exception 'Use the voucher redemption action.'; end if;
  return new;
 end if;
 return old;
end $$;

create function private.manage_payment_voucher(p_voucher_id uuid,p_request_id uuid,p_action text,p_valid_venue_keys text[],p_expires_at timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.payment_vouchers%rowtype; o public.staff_orders%rowtype; saved private.payment_voucher_management_requests%rowtype; venues text[]; signature text; result jsonb;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if p_request_id is null or p_action is null or p_action not in ('modify','delete') or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Enter a reason for this change.'; end if;
 select array_agg(distinct key order by key) into venues from unnest(p_valid_venue_keys) key;
 signature:=md5(jsonb_build_object('id',p_voucher_id,'action',p_action,'venues',venues,'expires_at',p_expires_at,'reason',trim(p_reason))::text);
 perform pg_advisory_xact_lock(hashtextextended('voucher-management:'||p_request_id::text,0));
 select * into saved from private.payment_voucher_management_requests where id=p_request_id;
 if found then
  select * into o from public.staff_orders where id=saved.source_order_id;
  if not found or not private.staff_location_order_allowed(o.session_id,o.arena_id) then raise exception 'Voucher not found or location access denied.'; end if;
  if saved.signature<>signature then raise exception 'Request reference already used.'; end if;
  return saved.response;
 end if;
 select * into v from public.payment_vouchers where id=p_voucher_id;
 if not found then raise exception 'Voucher not found or location access denied.'; end if;
 select * into o from public.staff_orders where id=v.source_order_id for update;
 if not found or not private.staff_location_order_allowed(o.session_id,o.arena_id) then raise exception 'Voucher not found or location access denied.'; end if;
 select * into v from public.payment_vouchers where id=p_voucher_id for update;
 if not found then raise exception 'Voucher not found or location access denied.'; end if;
 if p_action='delete' then
  if v.balance<>v.amount or exists(select 1 from public.payment_voucher_redemptions where voucher_id=v.id) then raise exception 'Only unused vouchers can be deleted.'; end if;
  insert into private.deleted_payment_vouchers(voucher_id,source_order_id,source_payment_id,amount) values(v.id,v.source_order_id,v.source_payment_id,v.amount);
  delete from public.payment_vouchers where id=v.id;
  result:=jsonb_build_object('id',v.id,'deleted',true,'restored_amount',0);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value) values(auth.uid(),'payment_voucher_deleted_as_mistake','payment_vouchers',v.id,to_jsonb(v)-'code',result||jsonb_build_object('reason',trim(p_reason)));
 else
  if coalesce(cardinality(venues),0)=0 or array_position(venues,null) is not null or exists(select 1 from unnest(venues) key where not exists(select 1 from public.staff_locations l where l.venue_key=key and l.active)) then raise exception 'Select at least one active venue.'; end if;
  if p_expires_at is not null and (not isfinite(p_expires_at) or p_expires_at<=now()) then raise exception 'Choose a future expiry date or no expiry.'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value) values(auth.uid(),'payment_voucher_modified','payment_vouchers',v.id,to_jsonb(v)-'code',jsonb_build_object('valid_venue_keys',venues,'expires_at',p_expires_at,'reason',trim(p_reason)));
  update public.payment_vouchers set issued_venue_keys=coalesce(issued_venue_keys,valid_venue_keys,array[venue_key]),valid_venue_keys=venues,expires_at=p_expires_at where id=v.id returning * into v;
  result:=to_jsonb(v);
 end if;
 insert into private.payment_voucher_management_requests(id,source_order_id,signature,response) values(p_request_id,o.id,signature,result);
 return result;
end $$;
create function public.staff_manage_payment_voucher(p_voucher_id uuid,p_request_id uuid,p_action text,p_valid_venue_keys text[],p_expires_at timestamptz,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$ select private.manage_payment_voucher(p_voucher_id,p_request_id,p_action,p_valid_venue_keys,p_expires_at,p_reason) $$;

create function private.payment_voucher_deleted_credits(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.staff_orders%rowtype;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 select * into o from public.staff_orders where id=p_order_id;
 if not found or not private.staff_location_order_allowed(o.session_id,o.arena_id) then raise exception 'Order not found or location access denied.'; end if;
 return coalesce((select jsonb_object_agg(source_payment_id,amount) from (select source_payment_id,sum(amount) amount from private.deleted_payment_vouchers where source_order_id=p_order_id group by source_payment_id) totals),'{}'::jsonb);
end $$;
create function public.staff_payment_voucher_deleted_credits(p_order_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.payment_voucher_deleted_credits(p_order_id) $$;
revoke all on function private.manage_payment_voucher(uuid,uuid,text,text[],timestamptz,text),public.staff_manage_payment_voucher(uuid,uuid,text,text[],timestamptz,text),private.payment_voucher_deleted_credits(uuid),public.staff_payment_voucher_deleted_credits(uuid) from public,anon;
grant execute on function private.manage_payment_voucher(uuid,uuid,text,text[],timestamptz,text),public.staff_manage_payment_voucher(uuid,uuid,text,text[],timestamptz,text),private.payment_voucher_deleted_credits(uuid),public.staff_payment_voucher_deleted_credits(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
