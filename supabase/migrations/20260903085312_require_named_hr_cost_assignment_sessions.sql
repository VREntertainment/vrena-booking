begin;
alter policy "HR administrators read cost assignments" on public.staff_cost_assignments
using ((select private.is_hr_administrator()) and not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false));
alter policy "HR administrators create cost assignments" on public.staff_cost_assignments
with check ((select private.is_hr_administrator()) and not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and created_by = (select public.current_staff_actor_profile_id()) and cancelled_at is null and cancelled_by is null);
alter policy "HR administrators cancel cost assignments" on public.staff_cost_assignments
using ((select private.is_hr_administrator()) and not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) and cancelled_at is null)
with check ((select private.is_hr_administrator()) and not coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false)
  and cancelled_at is not null and cancelled_by = (select public.current_staff_actor_profile_id()));
commit;
