begin;
-- Register the existing PIN-email endpoint's dedicated 3-per-15-minute bucket.
do $$
declare v_definition text; v_anchor text := '''staff_config_write'','; begin
 select pg_get_functiondef('private.consume_rate_limit(text,integer,integer,text)'::regprocedure) into v_definition;
 if strpos(v_definition, '''employee_pin_email''') > 0 then return; end if;
 if strpos(v_definition, v_anchor) = 0 then raise exception 'Unexpected rate limiter definition'; end if;
 execute replace(v_definition, v_anchor, v_anchor || E'\n    ''employee_pin_email'',');
end $$;
commit;
