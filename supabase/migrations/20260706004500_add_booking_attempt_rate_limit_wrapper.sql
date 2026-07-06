begin;

create or replace function public.consume_booking_attempt_rate_limit(
  p_subject text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
begin
  return public.consume_rate_limit(
    'booking_attempt',
    3,
    60,
    coalesce(v_subject, 'anonymous')
  );
end;
$$;

revoke all on function public.consume_booking_attempt_rate_limit(text) from public;
grant execute on function public.consume_booking_attempt_rate_limit(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
