create table if not exists public.staff_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.staff_orders(id) on delete cascade,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer')),
  amount integer not null check (amount > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_order_payments_order_idx
on public.staff_order_payments (order_id, created_at);

alter table public.staff_order_payments enable row level security;

grant select, insert, update, delete on public.staff_order_payments to authenticated;
grant all on public.staff_order_payments to service_role;

drop policy if exists "staff order payments select" on public.staff_order_payments;
drop policy if exists "staff order payments insert" on public.staff_order_payments;
drop policy if exists "staff order payments update" on public.staff_order_payments;
drop policy if exists "staff order payments delete" on public.staff_order_payments;
create policy "staff order payments select" on public.staff_order_payments for select to authenticated using (public.is_staff_console_user(20));
create policy "staff order payments insert" on public.staff_order_payments for insert to authenticated with check (public.is_staff_console_user(50));
create policy "staff order payments update" on public.staff_order_payments for update to authenticated using (public.is_staff_console_user(50)) with check (public.is_staff_console_user(50));
create policy "staff order payments delete" on public.staff_order_payments for delete to authenticated using (public.is_staff_console_user(50));

drop trigger if exists staff_order_payments_audit on public.staff_order_payments;
create trigger staff_order_payments_audit after insert or update or delete on public.staff_order_payments
for each row execute function public.staff_audit_trigger();

alter table public.staff_orders
drop constraint if exists staff_orders_payment_method_check;

alter table public.staff_orders
add constraint staff_orders_payment_method_check
check (payment_method in ('cash', 'bank_transfer', 'split', 'momo_manual', 'card_manual', 'voucher', 'free_ticket', 'unpaid'));

alter table public.session_participants
add column if not exists payment_splits jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'session_participants_payment_splits_array_check'
      and conrelid = 'public.session_participants'::regclass
  ) then
    alter table public.session_participants
    add constraint session_participants_payment_splits_array_check
    check (jsonb_typeof(payment_splits) = 'array');
  end if;
end $$;

grant update (payment_splits) on public.session_participants to authenticated;
grant update on public.session_participants to service_role;

create or replace function public.create_staff_order_with_payments(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_game_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_players_count integer,
  p_arena_id text,
  p_discount_rule_id uuid,
  p_order_status text,
  p_invoice_required boolean default false,
  p_company_name text default null,
  p_tax_code text default null,
  p_invoice_email text default null,
  p_invoice_address text default null,
  p_internal_note text default null,
  p_manual_discount_type text default null,
  p_manual_discount_value numeric default 0,
  p_payment_splits jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := (select auth.uid());
  v_order jsonb;
  v_order_id uuid;
  v_total integer;
  v_split record;
  v_paid_total integer := 0;
  v_split_count integer := 0;
  v_first_method text := null;
  v_summary_method text := 'unpaid';
  v_payment_status text := 'unpaid';
begin
  if v_staff_id is null or not public.is_staff_console_user(50) then
    raise exception 'Staff access required.';
  end if;

  if p_payment_splits is null then
    p_payment_splits := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_payment_splits) <> 'array' then
    raise exception 'Payment splits must be an array.';
  end if;

  for v_split in
    select *
    from jsonb_to_recordset(p_payment_splits) as split(payment_method text, amount integer)
  loop
    if v_split.payment_method not in ('cash', 'bank_transfer') then
      raise exception 'Invalid split payment method.';
    end if;

    if v_split.amount is null or v_split.amount <= 0 then
      raise exception 'Split payment amount must be positive.';
    end if;

    v_split_count := v_split_count + 1;
    v_paid_total := v_paid_total + v_split.amount;
    v_first_method := coalesce(v_first_method, v_split.payment_method);
  end loop;

  v_order := public.create_staff_order(
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_game_id,
    p_booking_date,
    p_booking_time,
    p_players_count,
    p_arena_id,
    p_discount_rule_id,
    coalesce(v_first_method, 'unpaid'),
    'unpaid',
    p_order_status,
    p_invoice_required,
    p_company_name,
    p_tax_code,
    p_invoice_email,
    p_invoice_address,
    p_internal_note,
    p_manual_discount_type,
    p_manual_discount_value
  );

  v_order_id := (v_order->>'order_id')::uuid;
  v_total := coalesce((v_order->>'total')::integer, 0);

  insert into public.staff_order_payments (order_id, payment_method, amount, created_by)
  select
    v_order_id,
    split.payment_method,
    split.amount,
    v_staff_id
  from jsonb_to_recordset(p_payment_splits) as split(payment_method text, amount integer);

  if v_total <= 0 then
    v_payment_status := 'paid';
  elsif v_paid_total <= 0 then
    v_payment_status := 'unpaid';
  elsif v_paid_total >= v_total then
    v_payment_status := 'paid';
  else
    v_payment_status := 'partially_paid';
  end if;

  if v_split_count = 1 then
    v_summary_method := coalesce(v_first_method, 'unpaid');
  elsif v_split_count > 1 then
    v_summary_method := 'split';
  end if;

  update public.staff_orders
  set payment_method = v_summary_method,
      payment_status = v_payment_status,
      order_status = case
        when p_order_status in ('paid', 'partially_paid') then v_payment_status
        else p_order_status
      end
  where id = v_order_id;

  return v_order || jsonb_build_object(
    'paid_total', v_paid_total,
    'payment_status', v_payment_status,
    'payment_method', v_summary_method
  );
end;
$$;

revoke all on function public.create_staff_order_with_payments(
  uuid,
  text,
  text,
  text,
  uuid,
  date,
  time,
  integer,
  text,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  jsonb
) from public, anon;

grant execute on function public.create_staff_order_with_payments(
  uuid,
  text,
  text,
  text,
  uuid,
  date,
  time,
  integer,
  text,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  jsonb
) to authenticated, service_role;
