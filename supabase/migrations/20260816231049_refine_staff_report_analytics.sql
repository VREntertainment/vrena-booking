-- Keep real booking demand intact while removing known internal/test players
-- from every non-booking Staff Report signal. The report resolves exclusions
-- from profiles at query time so the rule also applies to historical ranges.
create or replace function private.staff_report_profile_is_excluded(p_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.deleted_at is null
      and regexp_replace(lower(btrim(coalesce(profile.full_name, ''))), '\s+', ' ', 'g') = any (
        array['kiet hao', 'mathieu bernard', 'mathieur bernard', 'harris']::text[]
      )
  );
$function$;

revoke all on function private.staff_report_profile_is_excluded(uuid) from public, anon, authenticated;

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
    E'participant.profile_id,\n      coalesce(participant.checked_in, false) as checked_in,',
    E'participant.profile_id,\n      private.staff_report_profile_is_excluded(participant.profile_id) as is_report_excluded,\n      coalesce(participant.checked_in, false) as checked_in,'
  );
  if v_updated = v_definition then
    raise exception 'Could not add the named-profile flag to staff_player_behavior_report';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'count(*) filter (where activity.checked_in)',
    'count(*) filter (where activity.checked_in and not activity.is_report_excluded)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from visit counts';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'count(activity.profile_id) filter (where activity.checked_in)',
    'count(activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from participant visit counts';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'count(distinct activity.profile_id) filter (where activity.checked_in)',
    'count(distinct activity.profile_id) filter (where activity.checked_in and not activity.is_report_excluded)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from checked-in player counts';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'min(activity.session_date) filter (where activity.checked_in)',
    'min(activity.session_date) filter (where activity.checked_in and not activity.is_report_excluded)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from first-visit dates';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'max(activity.session_date) filter (where activity.checked_in)',
    'max(activity.session_date) filter (where activity.checked_in and not activity.is_report_excluded)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from last-visit dates';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'avg(activity.score) filter (where activity.checked_in and activity.score is not null)',
    'avg(activity.score) filter (where activity.checked_in and not activity.is_report_excluded and activity.score is not null)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from score averages';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'avg(activity.accuracy_percent) filter (where activity.checked_in and activity.accuracy_percent is not null)',
    'avg(activity.accuracy_percent) filter (where activity.checked_in and not activity.is_report_excluded and activity.accuracy_percent is not null)'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from accuracy averages';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    E'where activity.checked_in\n          and (',
    E'where activity.checked_in\n          and not activity.is_report_excluded\n          and ('
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from result coverage';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    'max(coalesce(activity.updated_at, activity.joined_at)) as latest_source_at',
    'max(coalesce(activity.updated_at, activity.joined_at)) filter (where not activity.is_report_excluded) as latest_source_at'
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from report freshness';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    E'and public.staff_role_rank(profile.role, profile.email) = 0\n          and (',
    E'and public.staff_role_rank(profile.role, profile.email) = 0\n          and not private.staff_report_profile_is_excluded(profile.id)\n          and ('
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from community activity';
  end if;

  execute v_updated;

  select pg_get_functiondef(
    'public.staff_product_analytics_report(date,date,date,date)'::regprocedure
  ) into v_definition;

  v_updated := replace(
    v_definition,
    E'      )\n  ),\n  summaries as (',
    E'      )\n      and not private.staff_report_profile_is_excluded(event.profile_id)\n  ),\n  summaries as ('
  );
  if v_updated = v_definition then
    raise exception 'Could not exclude named profiles from product analytics';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_updated,
    $needle$  session_acquisition as (
    select distinct on (event.session_id)
      event.session_id,
      coalesce(nullif(event.acquisition_source, ''), nullif(event.referrer_host, ''), 'Direct') as source,
      coalesce(nullif(event.acquisition_medium, ''), case when event.referrer_host is null then 'direct' else 'referral' end) as medium
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'page_view'
    order by event.session_id, event.created_at, event.id
  ),$needle$,
    $replacement$  raw_session_acquisition as (
    select distinct on (event.session_id)
      event.session_id,
      coalesce(nullif(event.acquisition_source, ''), nullif(event.referrer_host, ''), 'Direct') as source,
      coalesce(nullif(event.acquisition_medium, ''), case when event.referrer_host is null then 'direct' else 'referral' end) as medium
    from scoped_events event
    where event.range_key = 'current'
      and event.event_name = 'page_view'
    order by event.session_id, event.created_at, event.id
  ),
  session_acquisition as (
    select
      event.session_id,
      case
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('google', 'google ads', 'adwords') then 'Google Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('facebook', 'fb', 'meta') then 'Facebook Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) = 'instagram' then 'Instagram Ads'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('tiktok', 'tik tok') then 'TikTok Ads'
        when lower(event.source) in ('facebook', 'fb', 'meta') then 'Facebook'
        when lower(event.source) = 'instagram' then 'Instagram'
        when lower(event.source) in ('tiktok', 'tik tok') then 'TikTok'
        else event.source
      end as source,
      case
        when lower(event.medium) in ('social', 'organic', 'organic social', 'organic_social') then 'Organic social'
        when lower(event.medium) ~ '(paid|cpc|ppc)'
          and lower(event.source) in ('google', 'google ads', 'adwords') then 'Paid search'
        when lower(event.medium) ~ '(paid|cpc|ppc)' then 'Paid social'
        else event.medium
      end as medium
    from raw_session_acquisition event
  ),$replacement$
  );
  if v_updated = v_definition then
    raise exception 'Could not normalize social and paid acquisition sources';
  end if;

  execute v_updated;
end;
$migration$;

comment on function private.staff_report_profile_is_excluded(uuid) is
  'True for the named internal/test profiles excluded from Staff Report non-booking analytics.';

revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from public;
revoke all on function public.staff_player_behavior_report(date, date, date, date, integer) from anon;
grant execute on function public.staff_player_behavior_report(date, date, date, date, integer) to authenticated, service_role;

revoke all on function public.staff_product_analytics_report(date, date, date, date) from public;
revoke all on function public.staff_product_analytics_report(date, date, date, date) from anon;
grant execute on function public.staff_product_analytics_report(date, date, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
