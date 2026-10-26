begin;
-- Direct client inserts (the public Create Session form) are future-only, even
-- for staff accounts. Staff Console creation uses its existing SECURITY DEFINER
-- RPC, which verifies staff rank and enforces venue access via write triggers.
create policy sessions_direct_insert_future_only on public.sessions
as restrictive for insert to authenticated
with check ((date + start_time) > timezone('Asia/Ho_Chi_Minh', now()));
commit;
