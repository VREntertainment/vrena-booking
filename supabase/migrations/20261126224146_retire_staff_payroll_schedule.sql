begin;

-- The staff console no longer runs payroll. Keep historical records for existing readers.
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'staff-daily-payroll-sync';
  end if;
end $$;

revoke execute on function public.staff_sync_payroll_draft(date, boolean) from authenticated;

commit;
