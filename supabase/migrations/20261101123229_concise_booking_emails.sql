-- CLI migration creation was unavailable (both installed and pinned CLI SIGKILL).
-- Snapshot only after the transaction finishes: staff creation assigns source after session insertion.
create table private.booking_email_snapshots (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table private.booking_email_snapshots enable row level security;
revoke all on private.booking_email_snapshots from public, anon, authenticated;

create function private.booking_email_snapshot(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'session', (to_jsonb(s) - array['updated_at','created_at','seeded']) || jsonb_build_object(
      'notes', nullif(concat_ws(E'\n',nullif(s.notes,''),nullif(o.internal_note,'')),''),
      'booking_source', coalesce(o.booking_source, case when coalesce(public.staff_role_rank(creator.role,creator.email),0)<20 then 'website' else 'unspecified' end)),
    'order', case when o.id is null then null else jsonb_build_object(
      'order_number',o.order_number,'booking_date',o.booking_date,'booking_time',o.booking_time,
      'players_count',o.players_count,'total',o.total,'booking_source',o.booking_source,'order_status',o.order_status) end,
    'customer', jsonb_build_object(
      'name',case when o.id is not null then o.customer_name else coalesce(customer.nickname,customer.full_name) end,
      'phone',case when o.id is not null then o.customer_phone else customer.phone end,
      'email',case when o.id is not null then o.customer_email else customer.email end),
    'owner',jsonb_build_object('name',coalesce(owner_profile.nickname,owner_profile.full_name),'email',owner_profile.email,'phone',owner_profile.phone),
    'minor_warning',case when customer.birthday > current_date - interval '13 years' then 'UNDER-13 PLAYER: Staff must handle this booking with a parent/guardian.'
      when customer.birthday > current_date - interval '18 years' then 'MINOR PLAYER: Parent/guardian confirmation is required.' else null end
  ) from public.sessions s
  left join lateral (select * from public.staff_orders orders where orders.session_id=s.id order by orders.created_at desc, orders.id limit 1) o on true
  left join public.profiles customer on customer.id=coalesce(s.ticket_customer_id,s.owner_id)
  left join public.profiles owner_profile on owner_profile.id=s.owner_id
  left join public.profiles creator on creator.id=coalesce(o.created_by,s.owner_id)
  where s.id=p_session_id and not coalesce(s.seeded,false);
$$;
revoke all on function private.booking_email_snapshot(uuid) from public,anon,authenticated;

-- Baseline and trigger replacement share one consistent write boundary.
lock table public.sessions, public.staff_orders in share row exclusive mode;
-- Baseline existing bookings without sending any mail.
insert into private.booking_email_snapshots(session_id,snapshot)
select id,private.booking_email_snapshot(id) from public.sessions where not coalesce(seeded,false);

create function private.notify_booking_email_committed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_snapshot jsonb; v_previous jsonb; v_url text; v_secret text;
  v_event text; v_payload jsonb;
begin
  if tg_table_name='sessions' then v_id := new.id; else v_id := new.session_id; end if;
  if v_id is null then return new; end if;
  -- Serialize notifications for the same booking across concurrent transactions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text, 47));
  v_snapshot := private.booking_email_snapshot(v_id);
  if v_snapshot is null then return new; end if;
  select snapshot into v_previous from private.booking_email_snapshots where session_id=v_id for update;
  if v_snapshot is not distinct from v_previous then return new; end if;
  v_event := case when v_snapshot#>>'{session,booking_type}'='ticket' then 'ticket_' else 'session_' end ||
    case when v_snapshot#>>'{session,deleted_at}' is not null then 'deleted'
      when v_snapshot#>>'{session,status}'='cancelled' or v_snapshot#>>'{session,ticket_status}'='cancelled' or v_snapshot#>>'{order,order_status}'='cancelled' then 'cancelled'
      when v_previous is null then case when v_snapshot#>>'{session,booking_type}'='ticket' then 'booked' else 'created' end
      else 'updated' end;
  select value into v_url from private.integration_settings where key='google_sheets_webhook_url';
  select value into v_secret from private.integration_settings where key='google_sheets_webhook_secret';
  v_payload := v_snapshot || jsonb_build_object(
    'secret',v_secret,'source','supabase','event_type',v_event,'created_at',now(),
    'event_id',v_id::text || ':' || txid_current()::text,
    'app_url','https://booking.vre-vietnam.com','raw_session',v_snapshot->'session',
    'previous_session',v_previous->'session','previous_order',v_previous->'order',
    'previous_customer',v_previous->'customer','previous_raw_session',v_previous->'session');
  if nullif(v_url,'') is not null then
    perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json'),body:=v_payload,timeout_milliseconds:=5000);
  end if;
  insert into private.booking_email_snapshots(session_id,snapshot) values(v_id,v_snapshot)
    on conflict(session_id) do update set snapshot=excluded.snapshot,updated_at=now();
  return new;
exception when others then
  raise warning 'Booking email snapshot failed for %: %',v_id,sqlerrm;
  return new;
end $$;
revoke all on function private.notify_booking_email_committed() from public,anon,authenticated;

drop trigger sessions_google_sheets_insert_trigger on public.sessions;
drop trigger sessions_google_sheets_update_trigger on public.sessions;
create constraint trigger booking_email_session_committed after insert or update on public.sessions
  deferrable initially deferred for each row execute function private.notify_booking_email_committed();
create constraint trigger booking_email_order_committed after insert or update on public.staff_orders
  deferrable initially deferred for each row execute function private.notify_booking_email_committed();

-- The authenticated app endpoint uses this service-only probe to avoid a duplicate browser notice.
create function public.booking_email_managed(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.booking_email_snapshots where session_id=p_session_id and snapshot=private.booking_email_snapshot(p_session_id));
$$;
revoke all on function public.booking_email_managed(uuid) from public,anon,authenticated;
grant execute on function public.booking_email_managed(uuid) to service_role;
