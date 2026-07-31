-- Keep the privacy promise enforceable with a rolling 180-day retention job.
comment on table public.app_analytics_events is
  'Opted-in first-party product analytics retained for 180 days. Does not store raw IP addresses, full URLs, or search text.';

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

    perform cron.schedule(
      'purge-app-analytics-180d',
      '17 3 * * *',
      $purge$delete from public.app_analytics_events where created_at < now() - interval '180 days'$purge$
    );
  end if;
end;
$retention$;
