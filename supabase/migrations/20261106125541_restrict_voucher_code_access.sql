begin;
-- A bearer code authorizes spending. Read-only staff may inspect orders but must
-- not gain the ability to spend a customer's credit through public checkout.
alter policy voucher_read on public.payment_vouchers using (
 (customer_id=(select auth.uid()) and coalesce((select public.current_staff_role_rank()),0)<20)
 or ((select public.current_staff_role_rank())>=50 and private.staff_location_allowed(venue_key))
);
do $$ declare definition text; begin
 select pg_get_functiondef('private.convert_payment_to_voucher(uuid,uuid,uuid,integer,text)'::regprocedure) into definition;
 if strpos(definition,'''Voucher credit ''||v.code')=0 or strpos(definition,'''payment_vouchers'',v.id,to_jsonb(v)')=0 then
  raise exception 'Voucher issuance definition changed; inspect before altering.';
 end if;
 definition:=replace(definition,'''Voucher credit ''||v.code','''Voucher credit ''||v.id::text');
 definition:=replace(definition,'''payment_vouchers'',v.id,to_jsonb(v)','''payment_vouchers'',v.id,to_jsonb(v)-''code''');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
