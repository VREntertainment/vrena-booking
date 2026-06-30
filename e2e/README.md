# Playwright E2E

These tests exercise the admin/staff flows against local, preview, or staging only.

Required environment variables:

- `E2E_BASE_URL`: app URL. If omitted, Playwright starts `npm run dev` at `http://127.0.0.1:3000`.
- `E2E_ADMIN_EMAIL`: dedicated test admin email.
- `E2E_ADMIN_PASSWORD`: dedicated test admin password.

Do not use production credentials. The test env guard blocks the known production hosts.

Create the dedicated admin on local/staging only:

```sql
select public.vrena_e2e_prepare_admin(
  'e2e-admin@vrena.local',
  'replace-with-a-long-test-only-password',
  true
);
```

The helper lives in `supabase/e2e/create-admin-user.sql`. It is intentionally not a migration.

## Direct REST Security Probes

These tests simulate the browser-console attacks we want to block. They sign in
as a normal player, try direct REST writes against staff-only and trusted tables,
then verify with the staging service role that the fake fixture rows did not
change.

Use staging or local fake data only. Do not run this against production.

Prepare deterministic fake users and rows on staging/local:

```sql
select public.vrena_e2e_prepare_security_fixtures(
  'security-player@vrena.local',
  'replace-with-a-long-test-only-password',
  'security-staff@vrena.local',
  'replace-with-a-long-test-only-password',
  true
);
```

The helper lives in `supabase/e2e/create-security-fixtures.sql`. It is
intentionally not a migration.

Set matching env vars:

```bash
SECURITY_REST_TESTS=1
SECURITY_STAGING_CONFIRMATION=I_AM_USING_STAGING_OR_LOCAL_FAKE_DATA
SECURITY_BASE_URL=https://your-preview-or-staging-app.example
SECURITY_SUPABASE_URL=https://your-staging-project.supabase.co
SECURITY_SUPABASE_ANON_KEY=your-staging-anon-key
SECURITY_SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
SECURITY_PLAYER_EMAIL=security-player@vrena.local
SECURITY_PLAYER_PASSWORD=replace-with-a-long-test-only-password
```

Run:

```bash
npm run test:security
```

Run locally:

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
```

WebKit is opt-in because local and CI machines may not always have the browser installed:

```bash
E2E_ENABLE_WEBKIT=1 npm run test:e2e
```

## CAPTCHA and OTP Strategy

The current login flow supports email and password. The Playwright helper stubs the browser hCaptcha script so local UI tests can reach the real Supabase password login flow without manual CAPTCHA interaction when server-side CAPTCHA enforcement is disabled.

If Supabase CAPTCHA enforcement is enabled server-side for the staging project, use a staging-only hCaptcha test key or disable CAPTCHA only for that staging test project. Creating the SQL user alone is not enough when Supabase rejects missing or fake CAPTCHA tokens. Do not add a production bypass.

If the app ever moves to OTP-only login, use a test-only strategy with all of these gates:

- Only compile or enable the route when `NODE_ENV !== "production"` and `E2E_TEST_LOGIN_ENABLED=true`.
- Reject known production hosts before issuing any session.
- Require a server-only `E2E_TEST_LOGIN_SECRET` header.
- Allow only a dedicated allowlisted test admin email.
- Use Supabase Admin APIs on staging/test to mint a session or one-time link.
- Never deploy the secret, route, or allowlist to production.
