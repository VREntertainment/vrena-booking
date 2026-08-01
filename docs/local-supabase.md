# Local Supabase

Use the local-only reset helper when rebuilding the development database from this repo:

```bash
npm run supabase:local:reset
```

The helper temporarily copies `supabase/local/20260614000000_core_schema_baseline.sql` into `supabase/migrations/`, runs a clean local Supabase rebuild, then removes the temporary migration file.

This keeps the core-schema baseline out of deployable migrations. Do not deploy files from `supabase/local/` to production Supabase.

Notes:

- The command runs `supabase stop --no-backup`, so it deletes local Supabase Docker data.
- It starts Supabase with `--exclude edge-runtime` because the current local Edge Runtime boot can fail while resolving third-party function dependencies.
- E2E fixture SQL remains in `supabase/e2e/` and is not part of migrations.

