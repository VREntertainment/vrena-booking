begin;

create table if not exists public.staff_zalo_settings (
  id text primary key default 'default' check (id = 'default'),
  enabled boolean not null default true,
  require_location boolean not null default true,
  allow_timesheet boolean not null default true,
  allow_payslip boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.staff_zalo_settings (id)
values ('default')
on conflict (id) do nothing;

drop trigger if exists staff_zalo_settings_touch_updated_at on public.staff_zalo_settings;
create trigger staff_zalo_settings_touch_updated_at
before update on public.staff_zalo_settings
for each row execute function public.staff_attendance_touch_updated_at();

create table if not exists public.staff_check_in_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null default 30 check (radius_meters between 10 and 500),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text,
  constraint staff_check_in_locations_name_length check (length(btrim(name)) between 1 and 120),
  constraint staff_check_in_locations_address_length check (address is null or length(address) <= 500)
);

create index if not exists staff_check_in_locations_active_idx
  on public.staff_check_in_locations (active, name)
  where deleted_at is null;

drop trigger if exists staff_check_in_locations_touch_updated_at on public.staff_check_in_locations;
create trigger staff_check_in_locations_touch_updated_at
before update on public.staff_check_in_locations
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_zalo_settings enable row level security;
alter table public.staff_check_in_locations enable row level security;

revoke all on table public.staff_zalo_settings, public.staff_check_in_locations from public, anon, authenticated;
grant select, update on table public.staff_zalo_settings to authenticated;
grant select, insert, update, delete on table public.staff_check_in_locations to authenticated;
grant all on table public.staff_zalo_settings, public.staff_check_in_locations to service_role;

drop policy if exists "staff zalo settings manage" on public.staff_zalo_settings;
create policy "staff zalo settings manage"
on public.staff_zalo_settings
for all to authenticated
using (public.current_staff_role_rank() >= 100)
with check (public.current_staff_role_rank() >= 100);

drop policy if exists "staff check in locations manage" on public.staff_check_in_locations;
create policy "staff check in locations manage"
on public.staff_check_in_locations
for all to authenticated
using (public.current_staff_role_rank() >= 100)
with check (public.current_staff_role_rank() >= 100);

alter table public.staff_attendance_logs
  add column if not exists clock_in_location_id uuid references public.staff_check_in_locations(id) on delete set null,
  add column if not exists clock_out_location_id uuid references public.staff_check_in_locations(id) on delete set null,
  add column if not exists clock_in_distance_meters integer check (clock_in_distance_meters is null or clock_in_distance_meters >= 0),
  add column if not exists clock_out_distance_meters integer check (clock_out_distance_meters is null or clock_out_distance_meters >= 0);

create or replace function public.staff_zalo_attendance_clock(
  p_identity_id uuid,
  p_action text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_provider text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.staff_zalo_settings%rowtype;
  v_location public.staff_check_in_locations%rowtype;
  v_distance_meters double precision;
  v_result jsonb;
  v_log_id uuid;
  v_idempotent boolean := false;
begin
  if p_action not in ('clock_in', 'clock_out') then
    raise exception 'Unsupported attendance action.';
  end if;

  select *
  into v_settings
  from public.staff_zalo_settings
  where id = 'default';

  if not found or not v_settings.enabled then
    raise exception 'Zalo employee attendance is disabled.';
  end if;

  if v_settings.require_location then
    if p_latitude is null
      or p_longitude is null
      or p_latitude not between -90 and 90
      or p_longitude not between -180 and 180
    then
      raise exception 'A current location is required to record attendance.';
    end if;

    select location.*
    into v_location
    from public.staff_check_in_locations as location
    where location.active = true
      and location.deleted_at is null
    order by 6371000 * acos(
      least(1, greatest(-1,
        cos(radians(p_latitude))
          * cos(radians(location.latitude))
          * cos(radians(location.longitude) - radians(p_longitude))
        + sin(radians(p_latitude))
          * sin(radians(location.latitude))
      ))
    ) asc
    limit 1;

    if not found then
      raise exception 'Attendance location is not configured.';
    end if;

    v_distance_meters := 6371000 * acos(
      least(1, greatest(-1,
        cos(radians(p_latitude))
          * cos(radians(v_location.latitude))
          * cos(radians(v_location.longitude) - radians(p_longitude))
        + sin(radians(p_latitude))
          * sin(radians(v_location.latitude))
      ))
    );

    if v_distance_meters > v_location.radius_meters then
      raise exception 'You are outside an approved check-in location.';
    end if;
  end if;

  v_result := public.staff_zalo_attendance_clock(p_identity_id, p_action, p_now);
  v_log_id := nullif(v_result #>> '{attendance_log,id}', '')::uuid;
  v_idempotent := coalesce((v_result ->> 'idempotent')::boolean, false);

  if v_settings.require_location and v_log_id is not null and not v_idempotent then
    if p_action = 'clock_in' then
      update public.staff_attendance_logs
      set
        clock_in_location_id = v_location.id,
        clock_in_distance_meters = round(v_distance_meters)::integer
      where id = v_log_id;
    else
      update public.staff_attendance_logs
      set
        clock_out_location_id = v_location.id,
        clock_out_distance_meters = round(v_distance_meters)::integer
      where id = v_log_id;
    end if;

    update public.staff_zalo_attendance_events
    set event_payload = event_payload || jsonb_build_object(
      'location_id', v_location.id,
      'location_name', v_location.name,
      'distance_meters', round(v_distance_meters)::integer,
      'location_provider', nullif(left(coalesce(p_location_provider, ''), 40), '')
    )
    where attendance_log_id = v_log_id
      and event_type = p_action
      and event_at = p_now;
  end if;

  return v_result || jsonb_build_object(
    'location', case
      when v_settings.require_location then jsonb_build_object(
        'id', v_location.id,
        'name', v_location.name,
        'distance_meters', round(v_distance_meters)::integer,
        'radius_meters', v_location.radius_meters
      )
      else null
    end
  );
end;
$$;

revoke all on function public.staff_zalo_attendance_clock(uuid, text, double precision, double precision, text, timestamptz) from public, anon, authenticated;
grant execute on function public.staff_zalo_attendance_clock(uuid, text, double precision, double precision, text, timestamptz) to service_role;

-- Force every external attendance write through the geofence-aware overload.
revoke execute on function public.staff_zalo_attendance_clock(uuid, text, timestamptz) from service_role;

commit;
