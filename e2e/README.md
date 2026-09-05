# Release checks

Use Node 24+, Docker, and Supabase CLI 2.106.0. No production account, hosted database, CAPTCHA secret, or email provider is required.

```sh
npm ci
npx playwright install chromium
npm run check
E2E_PRODUCTION_BUILD=1 npm run test:services
npm run measure:build
```

`test:services` starts the dedicated `vrena-health-ci` Docker project on ports 56430–56434, restores a data-free schema, applies newer migrations, seeds four game definitions, and creates a random `@vrena.local` admin. It enrolls a real local TOTP authenticator; the browser performs the email/password and authenticator-code sign-in. The browser CAPTCHA is simulated, while the isolated Auth service has CAPTCHA disabled. Production authentication is unchanged.

The runner always overrides the app's Supabase settings with local service values. Never copy production integration settings or credentials into this fixture. The snapshot contains no table data, integration settings, stored webhook URLs, or authentication accounts. Auth emails stay in the local mail catcher. The browser suite blocks known production domains; all remote test URLs require explicit `E2E_ALLOW_REMOTE_STAGING=1`.

The release gate covers:

- Lint, complete TypeScript checking (including test files), palette validation, and unit tests.
- Booking capacity/pricing, minor birthday locks, authorization hardening, concurrent kiosk sessions, and player-achievement database regressions (82 assertions).
- Desktop Chromium and Android Chrome sign-in, admin access, booking creation/editing, guest double-submit recovery, venue selection, and readiness.
- Light/dark fixtures and six public routes on phone, tablet, and desktop (42 theme cases).

The session creation/edit test runs once on desktop; the dedicated overflow test runs once on Android. The theme test invokes all viewport sizes once. These are intentional project-specific skips.

`npm run test:services -- --project=chromium --grep 'admin flows'` runs a focused local subset using the development server. `E2E_PRODUCTION_BUILD=1` builds and starts the production bundle. Reports, traces, videos, and theme screenshots are written under `/tmp/vrena-e2e-*` and `/tmp/vrena-theme-audit`; CI uploads them for seven days.

Stop only this test stack when finished:

```sh
supabase stop --workdir e2e --no-backup
```

## Schema baseline

`supabase/schema.sql` is a schema-only snapshot through migration `20260905011752`. The repository's earlier migrations are incremental and lack a complete original schema; replaying them into an empty database does not create a usable test environment. The runner restores this baseline once, then applies migrations with later version numbers in order. This file is a local/CI fixture, never a production migration. Refresh it when intentionally advancing the baseline and update the version in `scripts/test-local-services.mjs` together.

A full run of all 12 historical database audit files still reports failures in six files. Some fixtures omit mandatory session fields or use a removed message-moderation value; other assertions concern grants, authorization helpers, and public RPC allowlists and need separate security triage. Those failures have not been resolved by this engineering release. The six passing files above form the explicit release gate; they do not establish that every historical security assertion passes.

## Production verification

`GET /api/health` checks public database access and Auth health with a four-second deadline, returns 200 only when both respond successfully, and otherwise returns 503 without upstream details. Healthy responses may be cached for 15 seconds; failures are not cached. It does not prove that every privileged workflow or external integration is available.

`PERFORMANCE_BASE_URL=https://booking.vre-vietnam.com node scripts/measure-browser-performance.mjs` performs read-only, cold-cache mobile loading measurements on Tickets and Sessions. It does not log in or create records. These synthetic timings are useful for release comparisons and are not field Core Web Vitals.

Vercel server functions are configured in `vercel.json` for Sydney, matching the production database region. After merging, verify the production deployment's commit and region, the public health endpoint, protected API responses, and fresh browser navigation before calling the release complete.
