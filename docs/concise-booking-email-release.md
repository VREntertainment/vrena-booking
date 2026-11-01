# Concise booking email release

New and modified bookings share one branded layout at Hà Đô Centrosa and Thảo Điền. Status, venue/reference, date, time, players, total, actual booking category, customer contact and optional notes replace the verbose sections and game details. Modified fields have the previous value struck through and the new value bold; unchanged fields render normally. Zero prices and removed notes/contact values are explicit. Internal notes remain restricted to venue staff; customer creation confirmations retain their existing privacy boundary.

## Delivery

The existing Google Sheets/Gmail integration remains the delivery provider and retains venue From/Reply-To/recipient routing. The verified live creation deduplication and shared-inbox exclusion are now recorded in source. Update events gain an event ID for the same durable delivery guard. Webhook secrets are omitted from new raw audit rows.

Database notifications run at transaction completion, after linked orders, booking source and agreed total have been saved. A private, non-client-readable snapshot per session supplies old contacts, notes and source and collapses intermediate updates. Existing bookings are baselined without sending messages. Order-only edits now notify; source is never replaced by the editor's identity. The authenticated browser endpoint detects managed snapshots to avoid sending a second notice. Missing or failed snapshots retain its fallback.

The Apps Script renderer is generated from `lib/bookingEmailTemplate.ts` with `node scripts/generate-booking-email-template.mjs`. Tests enforce identical HTML across both delivery paths. Production configuration must be preserved when updating the script.

## Validation

- 267 unit/email tests plus booking measurement checks passed.
- 36 focused renderer/routing tests passed.
- All 669 database assertions across 42 isolated test files passed, including 25 focused email assertions: both venues, final creation source, order-only contact edits, note removal, price zero, session/order deduplication, unchanged source, session-only creation, cancellation, no-op updates and private snapshot access.
- Lint, TypeScript, module boundaries, palette check and production build passed; two unrelated existing lint warnings remain.
- Four clearly marked owner-inbox copies verified both sender identities and creation/modification rendering. No synthetic production reservations were created. Further verification is read-only.

## Verified production release — 1 November 2026

- Booking application: https://booking.vre-vietnam.com — Vercel READY at application commit `a320a8da41a6e6e891acd3bee964535cbc767c59` (PR #780); public homepage HTTP 200 and unauthenticated email endpoint HTTP 401.
- Google Apps Script: version 15 published at 19:31 Vietnam time on the existing endpoint; UI confirmed successful deployment. Venue routing, configuration and creation duplicate protection preserved.
- Supabase production migration: `20261101123229_concise_booking_emails`, read back after installation. The repository filename matches the version assigned by the migration service.
- Both deferred triggers are installed; both former immediate Google Sheets triggers are absent. All 147 existing snapshots are current (103 Hà Đô, 44 Thảo Điền). Snapshot probing is denied to anonymous and ordinary authenticated roles.
- Security advisor's private-table/no-policy informational item is intentional: snapshots are not client-readable and are accessed only through restricted server functions.
- GitHub's broader CI was still running when this record was written; local checks and the production deployment were verified independently.

Future real-booking inbox delivery has not been exercised by creating a synthetic production reservation.
