-- Keep every player-facing visitor in product analytics while excluding staff
-- accounts from both digital and venue behavior reporting. The role check is
-- evaluated when each report runs, so later role changes are reflected across
-- historical reporting as well.

do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(
    'public.staff_player_behavior_report(date,date,date,date,integer)'::regprocedure
  ) into v_definition;

  v_updated := replace(
    v_definition,
    'and not coalesce(profile.is_seed_demo, false)',
    E'and not coalesce(profile.is_seed_demo, false)\n      and public.staff_role_rank(profile.role, profile.email) = 0'
  );

  if v_updated = v_definition then
    raise exception 'Could not add the staff audience filter to staff_player_behavior_report';
  end if;

  execute v_updated;

  select pg_get_functiondef(
    'public.staff_product_analytics_report(date,date,date,date)'::regprocedure
  ) into v_definition;

  v_updated := replace(
    v_definition,
    $needle$where event.path !~ '^/(staff|hr|admin)(/|$)'$needle$,
    $replacement$where event.path !~ '^/(staff|hr|admin)(/|$)'
      and (
        event.profile_id is null
        or not exists (
          select 1
          from public.profiles analytics_profile
          where analytics_profile.id = event.profile_id
            and public.staff_role_rank(analytics_profile.role, analytics_profile.email) >= 20
        )
      )$replacement$
  );

  if v_updated = v_definition then
    raise exception 'Could not add the staff audience filter to staff_product_analytics_report';
  end if;

  v_updated := replace(
    v_updated,
    '''consentModel'', ''opt-in anonymous analytics''',
    '''consentModel'', ''privacy-policy-covered public analytics'''
  );
  v_updated := replace(
    v_updated,
    '''staff and admin routes excluded''',
    '''staff profiles and internal routes excluded'''
  );

  execute v_updated;
end;
$migration$;

comment on table public.app_analytics_events is
  'First-party player analytics for public app routes. Raw IP addresses, full URLs, search text, and staff activity are excluded from reporting.';
comment on column public.app_analytics_events.client_id is
  'Random browser identifier used for aggregate public-visitor analytics.';

revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from public;
revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from anon;
grant execute on function public.staff_player_behavior_report(date, date, date, date, integer) to authenticated, service_role;

revoke all on function public.staff_product_analytics_report(date, date, date, date) from public;
revoke all on function public.staff_product_analytics_report(date, date, date, date) from anon;
grant execute on function public.staff_product_analytics_report(date, date, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
