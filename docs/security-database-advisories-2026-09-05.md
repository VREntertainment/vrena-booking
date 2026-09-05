# Security and database advisory release — 5 September 2026

The production database changes below were applied to `ovahmlkfhxdskaebskme` and verified against fresh Supabase advisories. No paid plan, add-on, or external service was enabled.

## Security fixes

- Restored database enforcement of MFA for named staff accounts. The kiosk rollout had replaced the earlier check, allowing an AAL1 staff session to retain its database rank. Staff now need AAL2 plus a verified factor, current account/profile state, and a permanent account. Independently validated kiosk PIN sessions retain their existing role and operator attribution.
- Approved messages and tournament metadata now respect private-session visibility. An unrelated signed-in player cannot read private messages, editors, teams, or team members; session owners retain access.
- Public-club joining cannot assign an admin or forged owner role. Ordinary joining remains available, and club owners can still manage membership roles.
- Legacy admin policies now use the MFA-protected staff boundary. Browser roles lost unnecessary table administration grants; public writes remain behind validating booking RPCs. Tournament audit history is read-only to browsers.
- Internal role and attendance helpers have restricted execution. Three compatibility wrappers now run as the caller and delegate to separately authorized RPCs. Service-only analytics/archive tables have explicit deny policies and no browser grants.

## Fresh advisory results

| Advisory | Before | After | Disposition |
| --- | ---: | ---: | --- |
| RLS enabled with no policy | 2 | 0 | Explicit denial on service-only tables |
| Anonymous executable SECURITY DEFINER RPC | 12 | 11 | Reviewed public catalog, quote, and guest-booking endpoints; explicit test allowlist |
| Authenticated executable SECURITY DEFINER RPC | 64 | 58 | Reviewed application endpoints with object, role, or actor checks; explicit test allowlist |
| Anonymous Auth policy notice | 53 | 3 | Application notices resolved; two managed cron tables and Storage remain, as explained below |
| Leaked-password protection | 1 | 1 | Supabase requires Pro or above; left disabled to honor the free-account requirement |
| Repeated Auth calls in RLS | 70 | 0 | Request-constant checks evaluated once through SELECT initplans |
| Overlapping permissive policies | 38 | 0 | Combined by role and operation, retaining restrictive guards and write predicates |
| Unindexed foreign keys | 83 | 73 | Ten targeted lookup indexes added; remaining informational suggestions deferred |
| Unused indexes | 41 | 51 | Existing indexes retained; ten newly created indexes naturally begin with zero scans |

Security notices decreased from **132 to 73**. Performance notices decreased from **232 to 124**, with **zero performance warnings**; the remainder are index information. These counts are a release snapshot, not a claim that every advisor notice represents a vulnerability or has been removed.

### Remaining security notices

The 69 executable-function notices represent 58 authenticated entries and 11 anonymous entries (some functions appear in both). Necessary privileged application RPCs retain their permissions; moving them behind unrestricted table grants would weaken security. Regression tests record their exact signatures and exercise booking, private-session access, staff MFA, kiosk access, and protected mutations.

The two `cron` notices concern extension-managed tables. Both browser roles lack `USAGE` on the cron schema, so their existing table-level grants do not permit direct access. The `storage.objects` notice does not recognize the separate restrictive `permanent accounts only` policy. Local regression fixtures include the production Storage policies and test anonymous-account rejection. Managed cron/Storage ownership and permissions were not changed by this release.

Supabase's built-in breached-password screening requires a paid plan. Existing CAPTCHA, password rules, rate limits, and staff MFA remain in place, but they do not replace breached-password screening. See the [official password-security documentation](https://supabase.com/docs/guides/auth/password-security).

### Index decisions within the free plan

The added indexes cover club membership, session invitations, waitlists, reverse follows, kiosk operators, attendance shifts, matched results, staff-order games, and club sessions. Existing composite indexes began with other columns. The largest affected table contained 547 rows at review; the database occupied about 40.6 MiB before this release.

The other 73 foreign-key suggestions are informational, predominantly small configuration, audit-attribution, HR, and tournament relationships. Existing pricing/loyalty lookup indexes already serve active-rule queries. No observed slow-query evidence justified adding every suggested index or dropping the 41 previously unused indexes. Constraint, recovery, and uncommon workflow indexes remain intact; freshly created indexes have no meaningful usage history yet. Statistics had last reset on 22 May 2026.

## Validation

- All 13 SQL regression files: **181 assertions passed**. The release gate now runs the entire directory; historical files are no longer excluded.
- Lint, TypeScript, palette checks, and **141 unit tests passed**; dependency audit found **zero vulnerabilities**.
- Production build passed. **29 browser tests passed**, with three intentional project-specific skips, covering desktop and Android login with real local MFA, staff/HR screens, booking creation/editing, guest retry behavior, readiness, and 42 light/dark viewport cases.
- A clean, isolated Docker database restored the schema and Storage fixtures and applied all three migrations successfully. No production customer data or integration credentials entered the test environment.
- Supabase's official database linter reported no repeated Auth-call or overlapping-policy warnings locally, confirmed by the production advisor after applying the migrations.
- Both production Edge Functions matched the reviewed repository source and returned **401** to empty unauthenticated requests. No messages were sent.
- The production health endpoint returned **200**, with database and Auth both healthy after migration.

The migration versions below match production history. All changes are compatible with the existing app. Migrations use bounded lock/statement timeouts and transactions; do not replay local-only schema or Storage fixtures on production.

1. `20260905045945_harden_security_advisories.sql`
2. `20260905050001_optimize_database_access_policies.sql`
3. `20260905050015_index_active_booking_and_staff_lookups.sql`

For background on interpreting intentional RPC notices, see [Supabase's SECURITY DEFINER advisor documentation](https://github.com/supabase/splinter/blob/main/docs/0029_authenticated_security_definer_function_executable.md). The remaining informational indexes should be reconsidered with actual query and storage measurements as the app grows.
