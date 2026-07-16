begin;

create table if not exists public.staff_zalo_identities (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.profiles(id) on delete cascade,
  zalo_app_user_id text not null,
  verified_phone_last_four text,
  linked_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_zalo_identities_user_id_length
    check (length(zalo_app_user_id) between 1 and 255),
  constraint staff_zalo_identities_phone_suffix_format
    check (verified_phone_last_four is null or verified_phone_last_four ~ '^[0-9]{4}$'),
  unique (staff_profile_id),
  unique (zalo_app_user_id)
);

create index if not exists staff_zalo_identities_active_user_idx
  on public.staff_zalo_identities (zalo_app_user_id)
  where revoked_at is null;

drop trigger if exists staff_zalo_identities_touch_updated_at on public.staff_zalo_identities;
create trigger staff_zalo_identities_touch_updated_at
before update on public.staff_zalo_identities
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_zalo_identities enable row level security;
revoke all on table public.staff_zalo_identities from public, anon, authenticated;
grant all on table public.staff_zalo_identities to service_role;

create table if not exists public.staff_zalo_attendance_events (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid references public.staff_zalo_identities(id) on delete set null,
  staff_profile_id uuid references public.profiles(id) on delete set null,
  attendance_log_id uuid references public.staff_attendance_logs(id) on delete set null,
  event_type text not null
    check (event_type in ('link', 'status', 'clock_in', 'clock_out', 'link_failed')),
  event_at timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  constraint staff_zalo_attendance_events_payload_object
    check (jsonb_typeof(event_payload) = 'object')
);

create index if not exists staff_zalo_attendance_events_staff_time_idx
  on public.staff_zalo_attendance_events (staff_profile_id, event_at desc);

create index if not exists staff_zalo_attendance_events_identity_time_idx
  on public.staff_zalo_attendance_events (identity_id, event_at desc);

alter table public.staff_zalo_attendance_events enable row level security;
revoke all on table public.staff_zalo_attendance_events from public, anon, authenticated;
grant all on table public.staff_zalo_attendance_events to service_role;

create or replace function public.staff_zalo_attendance_clock(
  p_identity_id uuid,
  p_action text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity public.staff_zalo_identities%rowtype;
  v_employee public.staff_employee_profiles%rowtype;
  v_shift public.staff_schedule_shifts%rowtype;
  v_log public.staff_attendance_logs%rowtype;
  v_work_date date := (p_now at time zone 'Asia/Ho_Chi_Minh')::date;
  v_local_time time := (p_now at time zone 'Asia/Ho_Chi_Minh')::time;
  v_standard_daily_minutes integer := 480;
  v_night_start time := '22:00';
  v_night_end time := '06:00';
  v_scheduled_minutes integer := 480;
  v_worked_minutes integer := 0;
  v_regular_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_night_minutes integer := 0;
  v_status text := 'present';
begin
  if p_action not in ('clock_in', 'clock_out') then
    raise exception 'Unsupported attendance action.';
  end if;

  if p_identity_id is null then
    raise exception 'A linked Zalo identity is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_identity_id::text, 0));

  select *
  into v_identity
  from public.staff_zalo_identities
  where id = p_identity_id
    and revoked_at is null;

  if not found then
    raise exception 'The Zalo account is not linked to an employee.';
  end if;

  select *
  into v_employee
  from public.staff_employee_profiles
  where profile_id = v_identity.staff_profile_id
    and active = true
    and coalesce(contract_status, 'active') in ('active', 'probation')
    and deleted_at is null;

  if not found then
    raise exception 'The employee profile is not active.';
  end if;

  perform public.consume_rate_limit(
    'staff_config_write',
    12,
    60,
    'zalo-attendance:' || p_action || ':' || p_identity_id::text
  );

  select
    coalesce(standard_daily_minutes, 480),
    coalesce(night_start, '22:00'::time),
    coalesce(night_end, '06:00'::time)
  into v_standard_daily_minutes, v_night_start, v_night_end
  from public.staff_attendance_settings
  where id = 'default';

  select *
  into v_shift
  from public.staff_schedule_shifts
  where staff_profile_id = v_identity.staff_profile_id
    and shift_date = v_work_date
    and status in ('published', 'completed')
    and deleted_at is null
  order by start_time asc
  limit 1;

  if p_action = 'clock_in' then
    select *
    into v_log
    from public.staff_attendance_logs
    where staff_profile_id = v_identity.staff_profile_id
      and clock_in_at is not null
      and clock_out_at is null
      and deleted_at is null
      and status not in ('absent', 'no_show', 'leave', 'holiday')
    order by clock_in_at desc
    limit 1
    for update;

    if found then
      return jsonb_build_object(
        'idempotent', true,
        'action', 'clock_in',
        'employee_profile_id', v_identity.staff_profile_id,
        'attendance_log', jsonb_build_object(
          'id', v_log.id,
          'work_date', v_log.work_date,
          'clock_in_at', v_log.clock_in_at,
          'clock_out_at', v_log.clock_out_at,
          'status', v_log.status,
          'break_minutes', v_log.break_minutes,
          'regular_minutes', v_log.regular_minutes,
          'overtime_minutes', v_log.overtime_minutes,
          'night_minutes', v_log.night_minutes
        )
      );
    end if;

    if v_shift.id is not null
      and v_local_time > (v_shift.start_time + interval '10 minutes')::time
    then
      v_status := 'late';
    end if;

    insert into public.staff_attendance_logs (
      staff_profile_id,
      shift_id,
      work_date,
      clock_in_at,
      break_minutes,
      status,
      created_by
    )
    values (
      v_identity.staff_profile_id,
      v_shift.id,
      v_work_date,
      p_now,
      coalesce(v_shift.break_minutes, 0),
      v_status,
      v_identity.staff_profile_id
    )
    returning * into v_log;

    insert into public.staff_zalo_attendance_events (
      identity_id,
      staff_profile_id,
      attendance_log_id,
      event_type,
      event_at,
      event_payload
    )
    values (
      v_identity.id,
      v_identity.staff_profile_id,
      v_log.id,
      'clock_in',
      p_now,
      jsonb_build_object('shift_id', v_shift.id, 'status', v_status)
    );
  else
    select *
    into v_log
    from public.staff_attendance_logs
    where staff_profile_id = v_identity.staff_profile_id
      and clock_in_at is not null
      and clock_out_at is null
      and deleted_at is null
      and status not in ('absent', 'no_show', 'leave', 'holiday')
    order by clock_in_at desc
    limit 1
    for update;

    if not found then
      raise exception 'There is no open attendance shift to clock out.';
    end if;

    if v_log.shift_id is not null then
      select * into v_shift
      from public.staff_schedule_shifts
      where id = v_log.shift_id;
    end if;

    v_worked_minutes := greatest(
      0,
      floor(extract(epoch from (p_now - v_log.clock_in_at)) / 60)::integer
        - coalesce(v_log.break_minutes, 0)
    );

    if v_shift.id is not null then
      v_scheduled_minutes := greatest(
        0,
        floor(
          extract(epoch from (
            (v_shift.shift_date + v_shift.end_time
              + case when v_shift.end_time <= v_shift.start_time then interval '1 day' else interval '0 day' end)
            - (v_shift.shift_date + v_shift.start_time)
          )) / 60
        )::integer - coalesce(v_shift.break_minutes, 0)
      );
    else
      v_scheduled_minutes := v_standard_daily_minutes;
    end if;

    v_regular_minutes := least(v_worked_minutes, greatest(0, v_scheduled_minutes));
    v_overtime_minutes := greatest(0, v_worked_minutes - v_regular_minutes);

    select coalesce(sum(overlap_minutes), 0)::integer
    into v_night_minutes
    from (
      select greatest(
        0,
        floor(extract(epoch from (
          least(p_now, night_end_at) - greatest(v_log.clock_in_at, night_start_at)
        )) / 60)::integer
      ) as overlap_minutes
      from (
        select
          ((night_date + v_night_start) at time zone 'Asia/Ho_Chi_Minh') as night_start_at,
          ((night_date + v_night_end
            + case when v_night_end <= v_night_start then interval '1 day' else interval '0 day' end)
            at time zone 'Asia/Ho_Chi_Minh') as night_end_at
        from (
          select
            ((v_log.clock_in_at at time zone 'Asia/Ho_Chi_Minh')::date - 1 + day_offset) as night_date
          from generate_series(
            0,
            greatest(
              1,
              (p_now at time zone 'Asia/Ho_Chi_Minh')::date
                - (v_log.clock_in_at at time zone 'Asia/Ho_Chi_Minh')::date
                + 1
            )
          ) as day_offset
        ) dates
      ) windows
      where least(p_now, night_end_at) > greatest(v_log.clock_in_at, night_start_at)
    ) overlap_rows;

    update public.staff_attendance_logs
    set clock_out_at = p_now,
        regular_minutes = v_regular_minutes,
        overtime_minutes = v_overtime_minutes,
        night_minutes = least(v_worked_minutes, greatest(0, v_night_minutes))
    where id = v_log.id
    returning * into v_log;

    insert into public.staff_zalo_attendance_events (
      identity_id,
      staff_profile_id,
      attendance_log_id,
      event_type,
      event_at,
      event_payload
    )
    values (
      v_identity.id,
      v_identity.staff_profile_id,
      v_log.id,
      'clock_out',
      p_now,
      jsonb_build_object(
        'regular_minutes', v_regular_minutes,
        'overtime_minutes', v_overtime_minutes,
        'night_minutes', v_log.night_minutes
      )
    );
  end if;

  update public.staff_zalo_identities
  set last_seen_at = p_now
  where id = v_identity.id;

  return jsonb_build_object(
    'idempotent', false,
    'action', p_action,
    'employee_profile_id', v_identity.staff_profile_id,
    'attendance_log', jsonb_build_object(
      'id', v_log.id,
      'work_date', v_log.work_date,
      'clock_in_at', v_log.clock_in_at,
      'clock_out_at', v_log.clock_out_at,
      'status', v_log.status,
      'break_minutes', v_log.break_minutes,
      'regular_minutes', v_log.regular_minutes,
      'overtime_minutes', v_log.overtime_minutes,
      'night_minutes', v_log.night_minutes
    )
  );
end;
$$;

revoke all on function public.staff_zalo_attendance_clock(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.staff_zalo_attendance_clock(uuid, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';

commit;
