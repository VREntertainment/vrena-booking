# Booking conversion measurement

GA4 property: existing G-1K2MBG959X. The primary new key event is `booking_completed`, with `booking_id`, `venue`, `booking_type`, and `player_count`. It is not payment revenue. Existing purchase/qualify_lead events remain unchanged for historical continuity; do not equate the legacy purchase event with a collected payment.

OpenAI Ads source: VRena Website & Booking, Pixel Y2uNue1R9VNaKHAjR1K9Ev. Conversion: Booking completed, standard base event `appointment_scheduled`. Browser Pixel plus server Conversions API. The server-only credential is `OPENAI_ADS_CAPI_KEY`, configured as a sensitive production variable in Vercel. `page_viewed` is measured on consented public page navigation. Both transports use `booking:<venue>:<session_id>` as Pixel `event_id` / CAPI `id`; same-tab duplicate booking reports are suppressed. Raw contact data is not supplied by this implementation. The provider's source settings and automatic advanced matching are separate from this code; review the conversion terms and existing marketing consent before release.

Only the server-confirmed ticket-booking success path emits the booking goal. RPC failures, unconfirmed responses, missing references and confirmation UI redisplays do not emit it. Individual, birthday and corporate bookings use the existing ticket flow across both venues. Member-created social sessions, waitlist actions, SIM racing and registrations are not counted by this ticket-booking goal; no separate success instrumentation was added to those flows.

GA4 follows analytics consent; the OpenAI SDK follows marketing (`all`) consent. Public staff/HR/admin/auth routes remain excluded. Tracking failures are isolated from booking completion. Full-consent attribution is forwarded from the marketing website to booking links using only oppref and UTM parameters, with a 30-minute per-tab attribution lifetime. No keys or tokens are logged. CSP permits only the documented OpenAI SDK/config and event hosts on public pages.

Skipped events: payment/order_created (payment not the requested success boundary), items_added (no cart), registration/subscription/trial/app events (outside this flow), lead_created (confirmed booking tracked directly), contents_viewed and checkout_started (deferred to avoid expanding the initial goal). Existing GA4 begin_checkout is retained. No raw or hashed customer contact fields are added: preserve the existing no-contact-data measurement policy. Existing Pixel matching behavior is unchanged. CAPI adds only consented browser references, user agent and the configured trusted client IP.

Validation: type checking, changed-file lint, and scripts/test-booking-measurement.mjs and scripts/test-openai-server-measurement.mjs (both included in `npm run check`). Live validation must distinguish SDK loading and accepted test events from attributed ad conversions, which require an eligible real ad click. No test should create a paid customer booking without a controlled test-data plan. Browser blockers and visitors declining consent reduce measurable coverage.

## Server delivery and venue identifiers

The ticket UI submits to `/api/bookings/tickets`, which allowlists the same three existing guest/account/Thảo Điền RPCs and forwards the caller JWT using the public Supabase key. Database authorization, rate limits, pricing and atomic capacity constraints remain authoritative. The endpoint accepts no browser-supplied success claim. Only an RPC result with `ticket_status=confirmed`, `session_id` and `ticket_reference` schedules measurement. Failed, incomplete or pending responses cannot emit the goal.

Next.js `after()` runs delivery after the booking response, with three bounded attempts for network errors, 429 and 5xx. Each attempt uses the original booking ID and commit-response timestamp. Other 4xx errors are not retried. Tracking construction, scheduling, transport and failures are isolated from booking success. This is bounded server delivery, not a durable outbox: platform termination or outages lasting beyond the retry window can still lose a server event; the browser path provides complementary coverage.

OpenAI's documented `customer_action` schema does not support arbitrary `venue` properties. The venue identifier is therefore encoded in the shared event ID (`ha_do_centrosa` or `thao_dien`), derived server-side from the selected RPC. GA4 continues to receive its separate `venue` field. This does not create a new venue reporting dimension in Ads Manager or change the existing appointment goal.

CAPI requires the request's marketing-consent cookie to equal `all`. It forwards raw `__oppref` unchanged, and `__obref` under `user.obref`; it never decodes attribution cookies or logs identity data. The browser supplies origin plus pathname only. Server `source_url` accepts `/tickets` only on the request or configured canonical origin, strips query/fragment, and falls back to canonical `/tickets`. No contact fields are hashed or added; no payment amount is claimed.

## 28 October 2026 verification

- Starting source: booking `dbfae4a0a199d9db95b70d0afed2bf2fe082bea6`; website `9c4f7eed55dbc86d1f67914c5008ee635e8ed7f3`.
- Connected source/pixel and `Booking completed` / `appointment_scheduled` goal verified on VRena HCM, attached to both venue campaigns. No campaign bidding/budget changes.
- Production-only sensitive CAPI credential provisioned. OpenAI validation-only request returned HTTP 200 and `accepted_events: 2` for both venue identifiers; this validates credentials/payloads without storing conversion events.
- Controlled desktop/mobile browser tests intercept booking writes and the Pixel transport. Both venue flows passed failed-check recovery, duplicate-click suppression and exactly one venue-tagged appointment event after mocked confirmed success. No live reservation or synthetic recorded conversion was created.
- Server tests cover guest/account RPCs, unconfirmed/failed responses, consent, shared event IDs, trusted URL fallback, opaque attribution, retries and failure isolation.
- Actual Ads attribution/deduplication receipt remains dependent on the next genuine consented booking; API validation and mocked success are not attributed-conversion proof.

References: [Pixel](https://developers.openai.com/ads/measurement-pixel), [CAPI](https://developers.openai.com/ads/conversions-api), [supported event schemas](https://developers.openai.com/ads/supported-events).
