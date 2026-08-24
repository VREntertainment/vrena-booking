begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'staff_employee_profiles'
      and policyname = 'staff employee profiles manage'
      and position('is_hr_administrator' in coalesce(qual, '')) > 0
      and position('is_hr_administrator' in coalesce(with_check, '')) > 0
  ),
  'employee profile management is limited to HR administrators'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'staff_hr_settings', 'staff_hr_setup_options', 'staff_hr_adjustments',
        'staff_payroll_runs', 'staff_payroll_items', 'staff_hr_documents',
        'staff_payroll_source_snapshots'
      )
      and (
        position('is_staff_attendance_editor' in coalesce(qual, '')) > 0
        or position('is_staff_attendance_editor' in coalesce(with_check, '')) > 0
      )
  ),
  'confidential HR policies do not inherit attendance-editor access'
);

select ok(
  pg_get_functiondef('public.staff_employee_directory()'::regprocedure)
    not similar to '%(base_salary|bank_account|identity_number|tax_code|emergency_contact)%',
  'the attendance directory does not return confidential HR fields'
);

select ok(
  pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
    not like '%revoked_reason = ''operator_switched''%'
    and pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure)
      like '%v_attempt_hash text := repeat(''0''%',
  'kiosk unlocks preserve concurrent stations and share one failure bucket'
);

select has_column('public', 'sessions', 'venue_key', 'sessions carry a venue scope');
select has_column('public', 'venue_game_results', 'venue_key', 'ingested results carry a venue scope');

select ok(
  to_regprocedure(
    'public.service_ingest_venue_game_result(uuid,text,text,text,integer,integer,double precision,numeric,text,timestamptz,text,text,text,text,uuid,uuid)'
  ) is not null,
  'the venue-scoped result ingest function is installed'
);

select ok(
  position(
    'ha-do-centrosa'
    in pg_get_functiondef(
      'public.service_ingest_venue_game_result(uuid,text,text,text,integer,integer,double precision,numeric,text,timestamptz,text,text,text,uuid,uuid)'::regprocedure
    )
  ) > 0,
  'the rolling-deployment compatibility function is pinned to the existing venue'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.service_reserve_venue_upload(text,text,integer)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.service_release_venue_upload(uuid)',
    'execute'
  ),
  'upload quota reservations are service-only'
);

select ok(
  exists (
    select 1 from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'zalo_webhook_receipts'
      and pg_class.relrowsecurity
  ),
  'webhook replay receipts have row-level security enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.zalo_webhook_receipts', 'select')
  and not has_table_privilege('authenticated', 'public.zalo_webhook_receipts', 'insert'),
  'browser users cannot inspect or forge webhook replay receipts'
);

select has_column(
  'public',
  'venue_result_reviews',
  'file_size_bytes',
  'review uploads record their accounted byte size'
);

select * from finish();

rollback;
