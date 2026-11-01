# Concise booking email release

New and modified bookings share one branded layout at Hà Đô Centrosa and Thảo Điền. Status, venue/reference, date, time, players, total, actual booking category, customer contact and optional notes replace the verbose sections and game details. Modified fields have the previous value struck through and the new value bold; unchanged fields render normally. Zero prices and removed notes/contact values are explicit. Internal notes remain restricted to venue staff; customer creation confirmations retain their existing privacy boundary.

## Delivery

The existing Google Sheets/Gmail integration remains the delivery provider and retains venue From/Reply-To/recipient routing. The verified live creation deduplication and shared-inbox exclusion are now recorded in source. Update events gain an event ID for the same durable delivery guard. Webhook secrets are omitted from new raw audit rows.

Database notifications run at transaction completion, after linked orders, booking source and agreed total have been saved. A private, non-client-readable snapshot per session supplies old contacts, notes and source and collapses intermediate updates. Existing bookings are baselined without sending messages. Order-only edits now notify; source is never replaced by the editor's identity. The authenticated browser endpoint detects managed snapshots to avoid sending a second notice. Missing or failed snapshots retain its fallback.

The Apps Script renderer is generated from `lib/bookingEmailTemplate.ts` with `node scripts/generate-booking-email-template.mjs`. Tests enforce identical HTML across both delivery paths. Production configuration must be preserved when updating the script.

## Validation

- 267 unit/email tests plus booking measurement checks passed.
- 36 focused renderer/routing tests passed.
- 25 isolated transactional database assertions passed: both venues, final creation source, order-only contact edits, note removal, price zero, session/order deduplication, unchanged source, session-only creation, cancellation, no-op updates and private snapshot access.
- Lint, TypeScript, module boundaries, palette check and production build passed; two unrelated existing lint warnings remain.
- Four clearly marked owner-inbox copies were sent before the user requested no test email. No additional mail tests will run. No synthetic production reservations were created.

Deployment status is recorded separately after read-back verification. Local tests do not establish recipient inbox delivery for real future bookings.
