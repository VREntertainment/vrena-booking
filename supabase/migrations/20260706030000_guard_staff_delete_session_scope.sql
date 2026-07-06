create or replace function public.staff_delete_session_operation(
  p_session_id uuid,
  p_delete_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_session public.sessions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_delete_reason, '')), '');
  v_sessions_deleted integer := 0;
  v_participants_deleted integer := 0;
  v_orders_cancelled integer := 0;
begin
  if v_actor is null or v_actor_rank < 50 then
    raise exception 'Staff access required.';
  end if;

  if p_session_id is null then
    raise exception 'Session id is required.';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Session not found.';
  end if;

  update public.session_participants
  set deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_reason, 'Deleted from Staff Console'),
      updated_at = now()
  where session_id = p_session_id
    and deleted_at is null;
  get diagnostics v_participants_deleted = row_count;

  update public.staff_orders
  set order_status = 'cancelled',
      updated_at = now(),
      internal_note = concat_ws(
        E'\n',
        nullif(internal_note, ''),
        'Session deleted from Staff Console by ' || v_actor::text || ' at ' || now()::text
      )
  where session_id = p_session_id
    and order_status not in ('cancelled', 'refunded');
  get diagnostics v_orders_cancelled = row_count;

  update public.sessions
  set status = 'cancelled',
      deleted_at = now(),
      deleted_by = v_actor,
      delete_reason = coalesce(v_reason, 'Deleted from Staff Console'),
      updated_at = now()
  where id = p_session_id
    and deleted_at is null;
  get diagnostics v_sessions_deleted = row_count;

  if v_sessions_deleted <> 1 then
    raise exception 'Delete scope failed. Expected exactly one session, got %.', v_sessions_deleted;
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'staff_session_deleted',
      'sessions',
      p_session_id,
      to_jsonb(v_session),
      jsonb_build_object(
        'deleted', true,
        'booking_type', v_session.booking_type,
        'ticket_reference', v_session.ticket_reference,
        'ticket_customer_id', v_session.ticket_customer_id,
        'participants_deleted', v_participants_deleted,
        'orders_cancelled', v_orders_cancelled,
        'reason', v_reason
      )
    );
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'ticket_reference', v_session.ticket_reference,
    'ticket_customer_id', v_session.ticket_customer_id,
    'deleted', true,
    'sessions_deleted', v_sessions_deleted,
    'participants_deleted', v_participants_deleted,
    'orders_cancelled', v_orders_cancelled
  );
end;
$$;

revoke all on function public.staff_delete_session_operation(uuid, text) from public, anon;
grant execute on function public.staff_delete_session_operation(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
