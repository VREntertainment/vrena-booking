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

The two `cron` notices concern extension-managed tables. Both browser roles lack `USAGE` on the cron schema, so their existing table-level grants do not permit direct access. The `storage.objects` notice does not recognize the separate restrictive `permanent accounts only` policy. The original regression checked Storage policy definitions; its behavioral anonymous-account tests targeted application tables. The follow-up below adds direct Storage row-operation coverage. Managed cron/Storage ownership and permissions were not changed by this release.

Supabase's built-in breached-password screening requires a paid plan. Existing CAPTCHA, password rules, rate limits, and staff MFA remain in place, but they do not replace breached-password screening. See the [official password-security documentation](https://supabase.com/docs/guides/auth/password-security).

### Follow-up: remaining-notice verification and failed-attempt patch

The remaining notices were rechecked on 5 September after the venue-hours release. The fresh production snapshot still contained 69 intentional executable-RPC entries, two managed cron-policy notices, one Storage-policy notice, and one paid-plan password-screening notice.

That review found a real defect inside three of the allowed RPCs: incorrect private-session codes and failed guest-booking claims raised exceptions after incrementing a database rate-limit counter. PostgreSQL rolled back the counter along with the rejected action. Direct RPC callers could therefore keep guessing without exhausting the intended attempt allowance; a separate browser-side limiter did not enforce that boundary.

Migration `20260905121203_preserve_failed_secret_attempt_limits.sql` isolates each protected operation in an exception subtransaction. Expected rejections roll back its intermediate writes while retaining the earlier attempt count. PostgREST receives the existing HTTP 400 and `error.message` response through `response.status`, so current browser clients continue to recognize failure. Successful joins/waitlist entries retain a null response; successful claims retain their existing result. The two join functions change their SQL return type from `void` to `jsonb`; no database dependants were found. All three retain their permanent-account checks, explicit execution grants, and existing ownership checks.

The limits remain five private-code attempts per session and twenty across sessions per account in ten minutes, shared by joining and waitlisting. Guest claims retain three attempts per phone/reference combination and ten across combinations per account in ten minutes. The HTTP regression suite covers committed rejection counts, mixed endpoints, concurrent guesses, rotating identifiers and phone formatting, failed-claim rollback, correct codes, and successful idempotent claims. The release runner now executes this suite before browser checks.

The successful-claim control exposed a second defect in the same operation: both ticket-protection triggers rejected the otherwise validated transfer from a guest to their account. Migration `20260905121218_allow_validated_guest_ticket_claims.sql` adds a private authorization row, created only after the claim's phone/reference/account checks and row locks. It binds the transaction, session, actor, previous owner/customer, and exact game-vote transfer. Both triggers accept only that transfer; every other column must remain unchanged except `updated_at`. The authorization is deleted immediately after the session update, and failures roll it back. Browser and service API roles cannot read/write that table or invoke the internal helper. No JWT identity or staff privilege is elevated.

The valid-claim test verifies customer and participant transfer, unchanged ticket/order/participant payment values, unchanged signed-in user identity, repeat-claim behavior, and continuing rejection of direct browser ownership/payment edits. Separate SQL tests reject forged settings, extra field changes, and reuse for another actor, transaction, or session.

Storage now has behavioral regression coverage for all four application buckets: anonymous Auth reads/uploads/updates/deletes are denied, authorized permanent owner/MFA-administrator access works, and an avatar cannot be moved into another account's path. The local test mirrors the Storage API's metadata-deletion transaction flag; it does not change production Storage settings or upload files.

The intentional RPC grants and managed cron/Storage permissions require no blanket revocation. Their dashboard notices are not proof of unauthorized access, and this patch does not suppress them. Supabase's built-in leaked-password notice remains unresolved under the free-plan constraint. Signup and password replacement are directly available through Supabase Auth, so an optional application-only screening check would be bypassable and is not presented as an equivalent fix.

Production anonymous account creation is now disabled and was verified after reloading the Supabase settings page. The application has no anonymous sign-in calls; the three existing anonymous accounts had no linked active profiles, owned sessions, or participants and had not signed in since 10 June. Existing accounts were retained. Ordinary public guest booking uses the separate public `anon` API role and remains enabled. A fresh security advisor check now contains **70 notices**: **69 intentional privileged RPC entries and one paid-plan leaked-password notice**. All three anonymous Auth policy notices cleared without changing extension-managed cron or Storage permissions.

Both follow-up migrations were applied to production at 12:12 UTC. All seven affected function definitions match the tested local database byte-for-byte. A rollback-only production probe confirmed that rejected join/waitlist attempts share and retain their counter and rejected guest claims retain their counter and HTTP error status. No customer bookings or accounts were created or changed by the probe. The private claim-context table is empty and inaccessible to browser/service API roles; managed cron remains inaccessible to browser roles. The public health endpoint reports database and Auth healthy.

Local release verification passed: **144 unit tests**, **252 SQL assertions across 17 files**, **8 direct HTTP security tests**, and **37 production-build browser tests** (three intentional project skips). The dedicated local tests include anonymous Auth accounts even when production disables new anonymous accounts, so existing-token restrictions remain covered.

Implementation references: [PostgREST transactions and response status](https://postgrest.org/en/stable/references/transactions.html), [intentional privileged RPCs](https://github.com/supabase/splinter/blob/main/docs/0029_authenticated_security_definer_function_executable.md), and [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

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
