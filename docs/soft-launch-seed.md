# Soft Launch Session Reset And Seed

This is a one-time launch helper for starting customer-facing sessions from a clean slate while keeping real accounts and profiles.

## Files

- `supabase/migrations/20260616123000_soft_launch_seed_support.sql`
  - Adds seed metadata to `sessions`.
  - Adds demo markers to `profiles`.
  - Creates service-role-only RPCs:
    - `vrena_soft_launch_reset_seed`
    - `vrena_soft_launch_rollback_seed`
- `supabase/migrations/20260616142000_soft_launch_demo_auth_users.sql`
  - Adds demo auth-user preparation for projects where `profiles.id` references `auth.users`.
  - Creates the preferred wrapper RPC:
    - `vrena_soft_launch_reset_seed_with_demo_auth`
- `scripts/soft-launch-seed.mjs`
  - Runs the destructive reset and seed RPC.
- `scripts/soft-launch-rollback.mjs`
  - Removes only sessions marked as seeded for the selected batch and their session-related rows.

## What The Reset Deletes

The reset deletes existing session-related rows only:

- `sessions`
- `session_participants`
- `session_messages`
- `session_invites`
- `session_waitlist`
- tournament tables with `session_id`, including editors, pools, pool entries, matches, and audit logs
- any other public table with a `session_id` column

It does not delete `auth.users`.

On projects where `profiles.id` references `auth.users`, it creates 12 dedicated demo auth users with `raw_app_meta_data.seed_demo = true` before creating the demo profiles.

It does not delete real `profiles`.

It creates/upserts dedicated demo profiles marked with:

- `is_seed_demo = true`
- `seed_batch = <batch>`

The rollback keeps those demo profiles and removes only seeded sessions plus their session-related data.

## What The Seed Creates

- 10 completed past sessions spread over the previous 2 weeks.
- 9 normal game sessions.
- 1 past tournament session.
- Mixed public and private visibility.
- Game choices from the current app game list.
- Demo participants with score, placement, accuracy, and shots.
- Normal in-session comments and creator announcements.
- Seeded sessions are marked:
  - `seeded = true`
  - `seed_batch = <batch>`
  - `seed_label = 'Soft Opening Highlights'`

## Safety Guard

Both scripts refuse to run unless:

```bash
ALLOW_PRODUCTION_SEED=true
```

Both scripts also require a Supabase service role key:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

The database RPC also requires the explicit boolean guard, so a direct call without the guard fails.

## Run The Migration

Apply the migration before running the seed:

```bash
supabase db push
```

Or paste the migration SQL into the Supabase SQL editor if you are managing migrations manually.

## Run The Reset And Seed

From the project root:

```bash
ALLOW_PRODUCTION_SEED=true \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run seed:soft-launch
```

If you run it manually in the Supabase SQL editor, use the auth-safe wrapper:

```sql
select public.vrena_soft_launch_reset_seed_with_demo_auth(
  true,
  'soft-launch-2026-06-16'
);
```

Optional custom batch:

```bash
ALLOW_PRODUCTION_SEED=true \
SEED_BATCH=soft-launch-2026-06-16 \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run seed:soft-launch
```

## Roll Back Seeded Sessions Only

```bash
ALLOW_PRODUCTION_SEED=true \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run seed:soft-launch:rollback
```

Use the same `SEED_BATCH` value if you used a custom batch.

## Transaction Behavior

The reset and rollback are each a single Postgres RPC call. If any delete or insert fails, Postgres rolls back the entire call.
