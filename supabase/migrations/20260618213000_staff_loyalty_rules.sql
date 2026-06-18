create table if not exists public.staff_loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  game_id uuid references public.staff_games(id) on delete set null,
  calculation_type text not null default 'per_vnd_spent'
    check (calculation_type in ('per_vnd_spent', 'per_booking', 'per_player', 'per_visit')),
  points_value numeric(10, 2) not null default 1 check (points_value >= 0),
  spend_amount integer not null default 100000 check (spend_amount >= 0),
  min_order_total integer not null default 0 check (min_order_total >= 0),
  point_expiry_days integer check (point_expiry_days is null or (point_expiry_days > 0 and point_expiry_days <= 3650)),
  valid_from date not null default current_date,
  valid_until date,
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  check (calculation_type <> 'per_vnd_spent' or spend_amount > 0)
);

create index if not exists staff_loyalty_rules_lookup_idx
on public.staff_loyalty_rules (active, game_id, calculation_type, valid_from, valid_until);

alter table public.staff_loyalty_rules enable row level security;

grant select, insert, update on public.staff_loyalty_rules to authenticated;

drop policy if exists "staff loyalty select" on public.staff_loyalty_rules;
drop policy if exists "staff loyalty insert" on public.staff_loyalty_rules;
drop policy if exists "staff loyalty update" on public.staff_loyalty_rules;
create policy "staff loyalty select" on public.staff_loyalty_rules for select to authenticated using (public.is_staff_console_user(20));
create policy "staff loyalty insert" on public.staff_loyalty_rules for insert to authenticated with check (public.is_staff_console_user(80));
create policy "staff loyalty update" on public.staff_loyalty_rules for update to authenticated using (public.is_staff_console_user(80)) with check (public.is_staff_console_user(80));

drop trigger if exists staff_loyalty_rules_set_updated_at on public.staff_loyalty_rules;
create trigger staff_loyalty_rules_set_updated_at before update on public.staff_loyalty_rules
for each row execute function public.staff_set_updated_at();

create or replace function public.staff_loyalty_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  if TG_OP = 'INSERT' then
    v_action := 'loyalty_rule_created';
  elsif old.active = true and new.active = false then
    v_action := 'loyalty_rule_deactivated';
  else
    v_action := 'loyalty_rule_edited';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_actor,
    v_action,
    TG_TABLE_NAME,
    new.id,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists staff_loyalty_rules_audit on public.staff_loyalty_rules;
create trigger staff_loyalty_rules_audit after insert or update on public.staff_loyalty_rules
for each row execute function public.staff_loyalty_audit_trigger();
