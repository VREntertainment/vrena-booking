begin;
do $$ declare definition text; begin
 select pg_get_functiondef('private.convert_payment_to_voucher(uuid,uuid,uuid,integer,text)'::regprocedure) into definition;
 if strpos(definition,'set total=total-p_amount,updated_at=now()')=0 then raise exception 'Voucher issuance definition changed; inspect before altering.'; end if;
 definition:=replace(definition,'set total=total-p_amount,updated_at=now()',
 $patch$set total=total-p_amount,
 payment_status=case when paid-p_amount>=total-p_amount then 'paid' when paid-p_amount>0 then 'partially_paid' else 'unpaid' end,
 order_status=case when order_status in ('paid','partially_paid') then case when paid-p_amount>=total-p_amount then 'paid' when paid-p_amount>0 then 'partially_paid' else 'confirmed' end else order_status end,
 updated_at=now()$patch$);
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
