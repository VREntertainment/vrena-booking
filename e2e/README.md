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
