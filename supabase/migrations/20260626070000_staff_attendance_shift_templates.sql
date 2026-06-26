begin;

alter table public.staff_attendance_settings
  add column if not exists standard_break_minutes integer not null default 60 check (standard_break_minutes >= 0),
  add column if not exists shift_templates jsonb not null default '[
    {"id":"opening","start_time":"09:00","end_time":"13:00","break_minutes":"0","shift_role":"Office Staff"},
    {"id":"afternoon","start_time":"13:00","end_time":"18:00","break_minutes":"30","shift_role":"Game Master"},
    {"id":"evening","start_time":"18:00","end_time":"22:00","break_minutes":"0","shift_role":"Office Staff"},
    {"id":"full_day","start_time":"09:00","end_time":"18:00","break_minutes":"60","shift_role":"Staff"}
  ]'::jsonb;

insert into public.staff_attendance_settings (
  id,
  location,
  standard_daily_minutes,
  standard_weekly_minutes,
  overtime_monthly_cap_minutes,
  overtime_yearly_cap_minutes,
  night_start,
  night_end,
  annual_leave_days,
  standard_break_minutes,
  shift_templates
)
values (
  'default',
  'VRena',
  480,
  2880,
  2400,
  12000,
  '22:00',
  '06:00',
  12,
  60,
  '[
    {"id":"opening","start_time":"09:00","end_time":"13:00","break_minutes":"0","shift_role":"Office Staff"},
    {"id":"afternoon","start_time":"13:00","end_time":"18:00","break_minutes":"30","shift_role":"Game Master"},
    {"id":"evening","start_time":"18:00","end_time":"22:00","break_minutes":"0","shift_role":"Office Staff"},
    {"id":"full_day","start_time":"09:00","end_time":"18:00","break_minutes":"60","shift_role":"Staff"}
  ]'::jsonb
)
on conflict (id) do update
set standard_break_minutes = coalesce(public.staff_attendance_settings.standard_break_minutes, excluded.standard_break_minutes),
    shift_templates = case
      when jsonb_typeof(public.staff_attendance_settings.shift_templates) = 'array' then
        case
          when jsonb_array_length(public.staff_attendance_settings.shift_templates) > 0
          then public.staff_attendance_settings.shift_templates
          else excluded.shift_templates
        end
      else excluded.shift_templates
    end;

commit;
