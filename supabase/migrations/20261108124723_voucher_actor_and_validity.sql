begin;
-- Employee/PIN identities are not customer profile IDs. Profile foreign keys
-- use the authenticated login; audit_logs already retains the named PIN operator,
-- operator session and role through attribute_staff_kiosk_audit().
-- Existing vouchers retain unlimited validity. Expiry is exclusive midnight in Vietnam.
alter table public.payment_vouchers
 add column valid_days integer check (valid_days between 1 and 3650),
 add column expires_at timestamptz;
create function private.convert_payment_to_voucher(p_order_id uuid,p_payment_id uuid,p_request_id uuid,p_amount integer,p_reason text,p_valid_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.staff_orders%rowtype; p public.staff_order_payments%rowtype; v public.payment_vouchers%rowtype; used bigint; paid bigint; venue text;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if p_request_id is null or p_amount is null or p_amount<=0 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Enter a positive whole VND amount and a reason.'; end if;
 if p_valid_days is not null and p_valid_days not between 1 and 3650 then raise exception 'Validity must be between 1 and 3650 days.'; end if;
 select * into o from public.staff_orders where id=p_order_id for update;
 if not found or not private.staff_location_order_allowed(o.session_id,o.arena_id) then raise exception 'Order not found or location access denied.'; end if;
 select * into v from public.payment_vouchers where id=p_request_id;
 if found then
  if v.source_order_id<>p_order_id or (p_payment_id is not null and v.source_payment_id<>p_payment_id) or v.amount<>p_amount or v.reason<>trim(p_reason) or v.valid_days is distinct from p_valid_days then raise exception 'Request reference already used.'; end if;
  return to_jsonb(v);
 end if;
 if o.payment_status='refunded' or o.order_status='refunded' then raise exception 'Refunded money cannot become voucher credit.'; end if;
 -- Older fully-paid orders may lack receipt rows. Materialize only an exact,
 -- unambiguous cash-method paid total, with its original date and audit linkage.
 if p_payment_id is null then
  if exists(select 1 from public.staff_order_payments where order_id=o.id) or o.payment_status<>'paid' or o.payment_method not in ('cash','bank_transfer','card_manual','momo_manual','vnpay') or o.total<=0 then raise exception 'Select a recorded receipt; reconcile missing historical receipts first.'; end if;
  insert into public.staff_order_payments(order_id,payment_method,amount,created_by,created_at) values(o.id,o.payment_method,o.total,auth.uid(),o.created_at) returning * into p;
 else
  select * into p from public.staff_order_payments where id=p_payment_id and order_id=o.id for update;
  if not found or p.amount<=0 then raise exception 'Select a positive recorded receipt.'; end if;
 end if;
 select coalesce(sum(amount),0) into used from public.payment_vouchers where source_payment_id=p.id;
 select coalesce(sum(amount),0) into paid from public.staff_order_payments where order_id=o.id;
 if p_amount>p.amount-used or p_amount>paid or p_amount>o.total then raise exception 'Amount exceeds the unconverted payment or order value.'; end if;
 select s.venue_key into venue from public.sessions s where s.id=o.session_id;
 venue:=coalesce(venue,case when o.arena_id='cafe:arena-1' then 'cafe-des-stagiaires' when o.arena_id in ('arena-1','arena-2','sim-racing-1','sim-racing-2') then 'ha-do-centrosa' end);
 if venue is null then raise exception 'Assign the order to a venue before conversion.'; end if;
 loop
 insert into public.payment_vouchers(id,code,source_order_id,source_payment_id,customer_id,venue_key,amount,balance,source_total_before,reason,created_by,valid_days,expires_at)
 values(p_request_id,private.new_payment_voucher_code(),o.id,p.id,o.customer_id,venue,p_amount,p_amount,o.total,trim(p_reason),auth.uid(),p_valid_days,case when p_valid_days is null then null else (((now() at time zone 'Asia/Ho_Chi_Minh')::date+p_valid_days+1)::timestamp at time zone 'Asia/Ho_Chi_Minh') end) on conflict(code) do nothing returning * into v;
 exit when found;
 end loop;
 insert into public.staff_order_payments(id,order_id,payment_method,amount,created_by) values(v.id,o.id,'voucher_conversion',-p_amount,auth.uid());
 -- Keep the existing balance due unchanged; conversion is a credit, not new cash.
 update public.staff_orders set total=total-p_amount,
 payment_status=case when paid-p_amount>=total-p_amount then 'paid' when paid-p_amount>0 then 'partially_paid' else 'unpaid' end,
 order_status=case when order_status in ('paid','partially_paid') then case when paid-p_amount>=total-p_amount then 'paid' when paid-p_amount>0 then 'partially_paid' else 'confirmed' end else order_status end,updated_at=now(),internal_note=concat_ws(E'\n',nullif(internal_note,''),'Voucher credit '||v.id::text||': '||p_amount||' VND. '||trim(p_reason)||case when invoice_status='issued' then ' Issued invoice requires credit reconciliation.' else '' end) where id=o.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value) values(auth.uid(),'payment_converted_to_voucher','payment_vouchers',v.id,to_jsonb(v)-'code');
 return to_jsonb(v);
end $$;

create or replace function private.convert_payment_to_voucher(p_order_id uuid,p_payment_id uuid,p_request_id uuid,p_amount integer,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
 select private.convert_payment_to_voucher(p_order_id,p_payment_id,p_request_id,p_amount,p_reason,null);
$$;
create function public.staff_convert_payment_to_voucher(p_order_id uuid,p_payment_id uuid,p_request_id uuid,p_amount integer,p_reason text,p_valid_days integer)
returns jsonb language sql security invoker set search_path='' as $$
 select private.convert_payment_to_voucher(p_order_id,p_payment_id,p_request_id,p_amount,p_reason,p_valid_days);
$$;
revoke all on function private.convert_payment_to_voucher(uuid,uuid,uuid,integer,text,integer),public.staff_convert_payment_to_voucher(uuid,uuid,uuid,integer,text,integer) from public,anon;
grant execute on function private.convert_payment_to_voucher(uuid,uuid,uuid,integer,text,integer),public.staff_convert_payment_to_voucher(uuid,uuid,uuid,integer,text,integer) to authenticated,service_role;
create or replace function private.redeem_payment_voucher(p_order_id uuid,p_code text,p_request_id uuid,p_amount integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.staff_orders%rowtype; v public.payment_vouchers%rowtype; r public.payment_voucher_redemptions%rowtype; paid bigint; methods integer; method text;
begin
 if auth.uid() is null or coalesce(public.current_staff_role_rank(),0)<50 then raise exception 'Staff access required.'; end if;
 if p_request_id is null or p_amount is null or p_amount<=0 then raise exception 'Enter a positive whole VND amount.'; end if;
 -- Lock order before voucher consistently with issuance. Concurrent redemptions
 -- of a voucher serialize here, including redemptions against different orders.
 select * into o from public.staff_orders where id=p_order_id for update;
 if not found or not private.staff_location_order_allowed(o.session_id,o.arena_id) then raise exception 'Order not found or location access denied.'; end if;
 select * into v from public.payment_vouchers where code=upper(trim(p_code)) for update;
 if not found or not private.staff_location_allowed(v.venue_key) then raise exception 'Voucher not found or location access denied.'; end if;
 select * into r from public.payment_voucher_redemptions where id=p_request_id;
 if found then
  if r.voucher_id<>v.id or r.order_id<>o.id or r.amount<>p_amount then raise exception 'Request reference already used.'; end if;
  return jsonb_build_object('voucher',to_jsonb(v),'order',to_jsonb(o));
 end if;
 if v.expires_at is not null and v.expires_at<=now() then raise exception 'Voucher has expired.'; end if;
 if o.order_status in ('cancelled','refunded','no_show') or o.payment_status='refunded' then raise exception 'This order cannot accept payment.'; end if;
 if o.id=v.source_order_id then raise exception 'Redeem on a different order.'; end if;
 -- Bearer codes can be shared. The linked profile stores a copy; it does not
 -- restrict gifting. Venue-scoped staff must have access to both sides.
 select coalesce(sum(amount),0) into paid from public.staff_order_payments where order_id=o.id;
 if paid=0 and o.payment_status in ('paid','partially_paid') and not exists(select 1 from public.staff_order_payments where order_id=o.id) then raise exception 'Reconcile historical receipts first.'; end if;
 if p_amount>v.balance or p_amount>o.total-paid then raise exception 'Amount exceeds voucher balance or order balance.'; end if;
 insert into public.payment_voucher_redemptions(id,voucher_id,order_id,amount,created_by) values(p_request_id,v.id,o.id,p_amount,auth.uid());
 insert into public.staff_order_payments(id,order_id,payment_method,amount,created_by) values(p_request_id,o.id,'voucher',p_amount,auth.uid());
 update public.payment_vouchers set balance=balance-p_amount where id=v.id returning * into v;
 select sum(amount),count(distinct payment_method) filter(where amount>0),min(payment_method) filter(where amount>0) into paid,methods,method from public.staff_order_payments where order_id=o.id;
 update public.staff_orders set payment_method=case when methods>1 then 'split' else method end,payment_status=case when paid>=total then 'paid' else 'partially_paid' end,order_status=case when order_status='completed' then 'completed' when paid>=total then 'paid' else 'partially_paid' end,updated_at=now() where id=o.id returning * into o;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value) values(auth.uid(),'voucher_redeemed','payment_voucher_redemptions',p_request_id,jsonb_build_object('voucher_id',v.id,'order_id',o.id,'amount',p_amount));
 return jsonb_build_object('voucher',to_jsonb(v),'order',to_jsonb(o));
end $$;
create or replace function private.quote_payment_voucher(p_code text,p_venue text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.payment_vouchers%rowtype; limits jsonb;
begin
 limits:=public.consume_rate_limit('voucher_quote',20,60,'value-voucher:'||coalesce(auth.uid()::text,split_part(coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-forwarded-for',',',1),'anonymous'));
 if not coalesce((limits->>'allowed')::boolean,false) then return jsonb_build_object('error','Please wait before checking another code.'); end if;
 select * into v from public.payment_vouchers where code=upper(trim(p_code)) and venue_key=p_venue and balance>0 and (expires_at is null or expires_at>now());
 if not found then return jsonb_build_object('error','Voucher is unavailable at this venue or has no remaining balance.'); end if;
 return jsonb_build_object('code',v.code,'balance',v.balance,'venue_key',v.venue_key);
end $$;
create or replace function private.book_ticket_with_payment_voucher(p_name text,p_args jsonb,p_code text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.payment_vouchers%rowtype; result jsonb; saved private.payment_voucher_booking_requests%rowtype; signature text; venue text; s public.sessions%rowtype; o public.staff_orders%rowtype; credit integer; games text[];
begin
 if p_request_id is null or p_code is null or p_code !~ '^[A-Za-z2-9]{8}$' then raise exception 'Enter the 8-character voucher code.'; end if;
 if p_name is null or jsonb_typeof(p_args) is distinct from 'object' or p_name not in ('create_ticket_booking','create_guest_ticket_booking','create_cafe_ticket_booking_request','create_sim_racing_booking') then raise exception 'Invalid booking type.'; end if;
 signature:=md5(jsonb_build_object('name',p_name,'args',p_args,'code',upper(p_code),'actor',auth.uid())::text);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into saved from private.payment_voucher_booking_requests where id=p_request_id;
 if found then
  if saved.fingerprint<>signature then raise exception 'Request reference already used.'; end if;
  return saved.response;
 end if;
 venue:=case when p_name='create_cafe_ticket_booking_request' then 'cafe-des-stagiaires' else 'ha-do-centrosa' end;
 select * into v from public.payment_vouchers where code=upper(p_code) for update;
 if not found or v.venue_key<>venue or v.balance<=0 or (v.expires_at is not null and v.expires_at<=now()) then raise exception 'Voucher is unavailable at this venue or has no remaining balance.'; end if;
 select array_agg(value) into games from jsonb_array_elements_text(p_args->'p_game_options');
 -- Delegate all pricing, age/contact, capacity, duplicate, and booking rules to
 -- the current canonical RPCs. Any failure rolls back credit and booking together.
 if p_name='create_sim_racing_booking' then
  result:=public.create_sim_racing_booking((p_args->>'p_date')::date,(p_args->>'p_start_time')::time,p_args->>'p_guest_phone',p_args->>'p_guest_name');
 elsif p_name='create_ticket_booking' then
  result:=public.create_ticket_booking(p_args->>'p_ticket_type',(p_args->>'p_date')::date,(p_args->>'p_start_time')::time,(p_args->>'p_duration_minutes')::integer,(p_args->>'p_player_count')::integer,(p_args->>'p_arena_count')::integer,games,(p_args->>'p_unit_price')::integer,(p_args->>'p_total_price')::integer,coalesce((p_args->>'p_loyalty_points_to_redeem')::integer,0),p_args->>'p_discount_code',p_args->>'p_special_note');
 elsif p_name='create_guest_ticket_booking' then
  result:=public.create_guest_ticket_booking(p_args->>'p_ticket_type',(p_args->>'p_date')::date,(p_args->>'p_start_time')::time,(p_args->>'p_duration_minutes')::integer,(p_args->>'p_player_count')::integer,(p_args->>'p_arena_count')::integer,games,(p_args->>'p_unit_price')::integer,(p_args->>'p_total_price')::integer,p_args->>'p_guest_phone',p_args->>'p_guest_name',p_args->>'p_guest_note');
 else
  result:=public.create_cafe_ticket_booking_request(p_args->>'p_ticket_type',(p_args->>'p_date')::date,(p_args->>'p_start_time')::time,(p_args->>'p_duration_minutes')::integer,(p_args->>'p_player_count')::integer,(p_args->>'p_arena_count')::integer,games,p_args->>'p_guest_phone',p_args->>'p_guest_name',p_args->>'p_special_note');
 end if;
 select * into s from public.sessions where id=(result->>'session_id')::uuid for update;
 if not found or s.venue_key is distinct from venue or s.ticket_status<>'confirmed' or coalesce(s.ticket_total_price,0)<=0 then raise exception 'Voucher requires a confirmed booking with a fixed price.'; end if;
 select * into o from public.staff_orders where session_id=s.id for update;
 if not found then
  insert into public.staff_orders(customer_id,customer_name,customer_phone,customer_email,session_id,game_id,booking_date,booking_time,players_count,arena_id,subtotal,total,payment_method,payment_status,order_status,internal_note)
  select s.ticket_customer_id,p.full_name,p.phone,p.email,s.id,(select id from public.staff_games where slug=games[1] limit 1),s.date,s.start_time,s.ticket_player_count,
  case when venue='cafe-des-stagiaires' then 'cafe:arena-1' else (select 'arena-'||min(arena_number)::text from private.arena_reservations where session_id=s.id) end,
  s.ticket_total_price,s.ticket_total_price,'unpaid','unpaid','confirmed','Online voucher booking. Reference: '||s.ticket_reference
  from public.profiles p where p.id=s.ticket_customer_id returning * into o;
 end if;
 if o.id is null or exists(select 1 from public.staff_order_payments where order_id=o.id) then raise exception 'Booking already has payments; review before redeeming.'; end if;
 credit:=least(v.balance,o.total);
 insert into public.payment_voucher_redemptions(id,voucher_id,order_id,amount,created_by) values(p_request_id,v.id,o.id,credit,auth.uid());
 insert into public.staff_order_payments(id,order_id,payment_method,amount,created_by) values(p_request_id,o.id,'voucher',credit,auth.uid());
 update public.payment_vouchers set balance=balance-credit where id=v.id;
 update public.staff_orders set payment_method='voucher',payment_status=case when credit>=total then 'paid' else 'partially_paid' end,order_status=case when credit>=total then 'paid' else 'partially_paid' end where id=o.id;
 result:=result||jsonb_build_object('voucher_code',v.code,'voucher_credit',credit,'amount_due',o.total-credit,'ticket_total_price',o.total,'order_id',o.id);
 insert into private.payment_voucher_booking_requests(id,fingerprint,response) values(p_request_id,signature,result);
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value) values(auth.uid(),'online_voucher_redeemed','payment_voucher_redemptions',p_request_id,jsonb_build_object('voucher_id',v.id,'order_id',o.id,'amount',credit));
 return result;
end $$;

notify pgrst,'reload schema';
commit;
