-- Keep consented product analytics until an explicit deletion policy is introduced.
comment on table public.app_analytics_events is
  'Opted-in first-party product analytics with no automatic retention limit. Does not store raw IP addresses, full URLs, or search text.';

do $retention$
declare
  v_job_id bigint;
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'purge-app-analytics-180d'
    loop
      perform cron.unschedule(v_job_id);
    end loop;
  end if;
end;
$retention$;
