begin;

create or replace function public.consume_password_reset_rate_limit(
  p_email text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_ip text := lower(coalesce(nullif(btrim(coalesce(p_ip, '')), ''), 'unknown'));
  v_result jsonb;
begin
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email.';
  end if;

  perform public.consume_rate_limit(
    'password_reset_ip',
    10,
    10 * 60,
    'ip:' || v_ip
  );

  v_result := public.consume_rate_limit(
    'password_reset',
    3,
    10 * 60,
    'email:' || v_email
  );

  return v_result;
end;
$$;

create or replace function public.consume_login_attempt_rate_limit(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
begin
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email.';
  end if;

  return public.consume_rate_limit(
    'login_attempt',
    5,
    10 * 60,
    'email:' || v_email
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer, text) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer, text) to authenticated, service_role;

revoke all on function public.consume_password_reset_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_password_reset_rate_limit(text, text) to service_role;

revoke all on function public.consume_login_attempt_rate_limit(text) from public;
grant execute on function public.consume_login_attempt_rate_limit(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
