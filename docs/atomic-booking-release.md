# Atomic booking release review — 12 October 2026

## Outcome and release gate

This change makes every successful online ticket booking confirmed immediately at both venues. It does not mark payment as received. Screens, event descriptions, guest prompts, seven language sets, and the customer email template remove the staff-approval step. Confirmation emails label the booking **Status: Confirmed**.

The owner subsequently authorized cancellation of the two later Thảo Điền bookings. `TD-261012-3C8EC6` and `TD-261012-16F77E` are cancelled with their records retained. The earliest booking, `TD-261012-AB100E`, remains and is confirmed. Production now has zero overlapping arena claims.

The database migration was installed as `20261012074852_atomic_arena_reservations`; the same migration was tested on an isolated PostgreSQL database. Apps Script version 13 is published on the existing webhook endpoint, preserving sender/routing configuration. The frontend release follows completion of repository checks. Phone numbers are mandatory for guest and signed-in online reservations, including SIM Racing; signed-in VR customers without a valid phone are directed to their profile.

## Findings

- Thảo Điền's production RPC returned `pending` and performed no capacity check. Its public time picker showed already occupied times. The live page still said “Send booking request.”
- Hà Đô's online RPCs checked existing overlapping rows with `FOR UPDATE`. This cannot lock a missing row or prevent a competing insert into an initially empty interval. Different start times bypass the incidental same-slot rate-limit serialization.
- Local reproduction with inspected production function definitions accepted six overlapping Thảo Điền bookings and six overlapping Hà Đô bookings. These were isolated test fixtures, never production bookings.
- Database exclusion protection existed for the separate SIM Racing product, but not VR arenas. Staff creation locks alone did not protect against online or direct session writes.
- Online Hà Đô guest orders were always labelled `arena-1`, even when a second physical arena was needed.
- Thảo Điền confirmation screens, guest prompts and event wording still implied staff approval. The email source could correctly render confirmed data but needed the requested explicit status label.
- Browser-based slot cutoffs depended on the visitor's local time. Database past-time checks already use Vietnam time.

## Enforcement and effects

`private.arena_reservations` records one half-open `[start,end)` interval per physical arena: Thảo Điền has arena 1; Hà Đô has arenas 1 and 2. A GiST exclusion constraint prevents overlapping claims on the same resource, including under stale transaction snapshots. All session inserts and operational updates, blocked-time writes, and staff-order arena assignments pass through database triggers. The private allocator is unavailable to browser roles. The public read RPC returns only venue, date, time, duration, and arena number; no customers, references, notes, or session IDs.

Pending reservations keep capacity until staff changes them. Cancellation, soft deletion, completion, and hard deletion release capacity; reactivation must acquire it again. Moving a reservation or changing arenas is transactional, so a rejected change preserves the original reservation. A two-arena booking claims both resources together. SIM Racing retains its separate 15-minute simulator constraint and consumes zero VR arenas. Existing blocked times are Hà Đô-only because that table has no venue field.

Online capacity comes from physical reservations, independent of which private bookings are visible to a customer. Consecutive bookings on one arena are not double-counted. Polling is only a display aid; database commit is authoritative. No confirmed screen is shown without a successful response containing a confirmed status, session ID, and reference.

Current standard tariff blocks are 30 minutes. Start grids remain 20 minutes at Hà Đô and 10 minutes at Thảo Điền. Public opening hours remain 09:00–22:00 and 15:30–23:00 respectively. Requested duration determines the entire reserved interval, including longer events. The online UI caps duration at 180 minutes; existing RPC validation allows up to 240 minutes. Staff's explicitly authorized outside-hours behavior is preserved. All new customer date defaults and slot cutoffs use `Asia/Ho_Chi_Minh`.

Historical rows are preserved; the initial ledger backfill includes active current-day and future reservations. Old open rows in historical dates are not retroactively reconciled. Staff approval of voucher discounts and guardian consent before participation remain separate from booking confirmation.

## Validation

Final checks passed: 204 unit/email tests; 59 SQL assertions across four suites; 14 desktop/mobile browser tests; 90 concurrent attempts across nine race scenarios; lint, type checking, architecture/palette checks, and the production build. Browser responses were intercepted; database concurrency tests used real isolated PostgreSQL transactions. Live email delivery and staging/production installation remain unverified.

- Real concurrent PostgreSQL transactions: 12 guest attempts accept exactly 1 at Thảo Điền, exactly 2 at Hà Đô, and exactly 1 for a two-arena booking.
- 12-attempt races also cover partially overlapping starts, online versus direct writes, and one blocked Hà Đô arena.
- Eight authenticated customer attempts accept exactly 1 at Thảo Điền and 2 at Hà Đô.
- A REPEATABLE READ race permits one winner despite both transactions starting with an old snapshot.
- Pending holds, cancellation, soft deletion, completion, adjacent bookings, rejected moves, order-arena consistency, closing boundaries, venue independence, and invalid durations/capacities are checked.
- Permission checks verify browser roles cannot mutate the ledger or call the allocator, but can read non-identifying occupancy.
- Migration on the baseline containing reproduced conflicts fails and leaves the old functions and schema intact.
- The existing staff booking suite, booking rules suite, and simulator suite are exercised on an isolated schema with the needed catalog fixtures. New SQL regression tests are included in the regular test directory.
- Unit/email tests cover the exact `Status: Confirmed` label at both venues. No real email was sent.
- Browser confirmation tests intercept writes and verify successful screens, failed-check recovery, duplicate-click prevention, and no page exceptions at desktop and Pixel 7 sizes. They are separate from the real SQL concurrency tests.

The local schema copy was aligned with inspected production booking functions and the simulator migration. It is not a full production-data clone. The initial audit was read-only. The later authorized release cancelled the two specified bookings, confirmed the retained booking, and installed the reviewed database protection. The Supabase security advisor reports existing anonymous SECURITY DEFINER RPC warnings; guest booking deliberately requires those public endpoints. New privileged helpers use an empty search path, live in `private`, and revoke customer execution.

## Release verification

The dependency audit now reports zero vulnerabilities after patching Sharp to 0.35.5 and source-map-js to 1.2.2. Six new database assertions verify required phone numbers. The final 90-attempt concurrency suite passes with these guards enabled. Staff orders without an arena label inherit the resource assigned by the database; explicit invalid assignments remain rejected. Security allowlists include the intentional, non-identifying occupancy RPC.

A synthetic production booking smoke test was rejected by automatic approval review because integration side effects might escape rollback. It was not executed. Verification uses isolated booking transactions, browser tests and read-only live checks instead. No test customer email was sent.

The security advisor's private-ledger RLS/no-policy notice is intentional default-deny behavior; browser roles have no ledger privileges. The public occupancy SECURITY DEFINER warning is intentional for the five-field anonymous availability endpoint, with no customer details exposed.

The separate cloud staging database is older and lacks SIM Racing; it was not modified. The isolated database used for migration/concurrency tests was aligned with inspected production definitions. Remaining release checks must pass before merging the app. A fresh public-site inspection and production deployment/commit verification are required after merge.

Rollback must preserve capacity enforcement; dropping the ledger/triggers restores the overbooking vulnerability. Prefer fixing forward.
