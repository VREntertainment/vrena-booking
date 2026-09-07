# Feature workflow refactor — 7 September 2026

This completes the four follow-ups to PR #693: staff workflow ownership, smaller HR contracts and views, customer workflow ownership, and measured loading improvements. The UI, translations, prices, booking queries, payroll calculations, and server authorization remain the existing implementation.

## Ownership

| Area | State and commands | Views |
| --- | --- | --- |
| Staff bookings, clients, orders | `features/staff/useStaffBookingState.ts`, `booking.actions.tsx`, `clients.actions.tsx`, `orders.actions.tsx` | `NewSection.tsx`, `ClientProfileSection.tsx` |
| Staff operations and reports | `useStaffOperationsState.ts`, `useStaffReportsState.ts`, `operations.actions.tsx`, `reports.actions.tsx` | `TodaySection.tsx`, `ReportSection.tsx` |
| Employees, scheduling, payroll, settings | Corresponding `useStaff…State.ts` and `…actions.tsx` files | `features/hr/*Section.tsx` |
| Customer tickets and sessions | `features/booking/useBookingTicketsState.ts`, `useBookingSessionsState.ts`, `useBookingSessionEditorState.ts`, and ticket/session command modules | Existing ticket/session surfaces |
| Login and profiles | `useBookingAuthenticationState.ts`, `useBookingProfilesState.ts`, and auth, MFA, passkey, recovery, profile commands | Existing profile/auth surfaces |
| Clubs and player interactions | `useBookingClubsState.ts`, club command/access modules | `ClubDetail.tsx`, `ChallengeControls.tsx` |
| Shared business rules | `lib/booking/`, `lib/staff/` | No dependency on their controllers |

The HR contract has six explicit groups: shared state, access, employees, schedule, payroll, and settings. Each HR view receives the fields and commands it uses. Each command module owns a named workflow rather than moving the old controller wholesale into a single hook.

Feature state hooks mount unconditionally in the parent. Switching views therefore preserves unsaved values and the refs that prevent duplicate requests. Command context readers close over the calling render, and each command reads its context at entry, before awaiting network calls. They are not mutable global contexts and do not silently adopt a later actor or draft during an in-flight request.

CAPTCHA callbacks, client warmup, message reset, and game-guide loading keep stable callback identities. Leaderboard rendering uses state for its loaded flag and selected query, while request handlers retain synchronous refs; render code no longer reads those refs.

Staff and HR views load separately. Club detail and challenge controls load when opened. Payroll export code loads only on request, after capturing the requested period; a failed module download reports the existing failure message. Controls that depend on a direct browser gesture, including passkeys, remain on their existing path.

## Measurements

Measured against main commit `4236706ce342743fe76b3bb0fc85c38bdb9b4403`, using local production builds, the same local dataset, desktop Chromium, and the first settled screen. Values below are **gzip-equivalent JavaScript KiB**, calculated from downloaded script bodies; they exclude HTML, images, data requests, and timing. They are not a claim about a user's exact network transfer or time to load.

| Route | Before | After | Change |
| --- | ---: | ---: | ---: |
| /tickets | 342.1 | 352.1 | 2.9% |
| /sessions | 410.4 | 421.0 | 2.6% |
| /clubs | 336.7 | 346.7 | 3.0% |
| /profile | 385.1 | 395.1 | 2.6% |
| /staff | 574.7 | 528.5 | -8.0% |
| /hr | 607.7 | 553.9 | -8.9% |
Staff and HR gain from deferring their optional screens and payroll export. Customer routes carry about 10 KiB more compressed JavaScript from the explicit feature contracts and command boundaries; this is a documented tradeoff, not a claim that every route got smaller.

Three identical duplicate style rules were removed (163 source bytes). The production CSS optimizer already coalesced them, so measured CSS downloads remain unchanged: 69.1 KiB gzip-equivalent for public pages and 105.5 KiB for staff/HR. No selectors, breakpoint behavior, colors, or cascade precedence changed. Tailwind scans `features/` so extracted views retain their generated utilities.

`npm run measure:build` now also reports feature-module sizes. The workflow browser test records complete JS/CSS asset lists and enforces production JS budgets of 570,000 gzip-equivalent bytes for `/staff` and 595,000 for `/hr`, both below the original measurements.

## Preservation and release checks

A one-off source comparison checked all 349 extracted state/ref initializers and 255 command bodies. All initializers and 250 bodies match the original emitted token sequences. Two export bodies differ only in rebased relative imports; three lifecycle methods delegate to shared helpers containing their original bodies. Runtime wiring, stable callback ownership, and leaderboard render state are covered by the assembled application tests rather than inferred from the source comparison alone.

API handlers, middleware, database migrations, RLS policies, security headers, dependency versions, and production service settings are unchanged. Server and database checks remain authoritative. No paid plan, dependency, database migration, or new service is required.

The architecture check retains the pure-domain and stylesheet checks, adds typed feature-module and runtime-cycle checks, prevents features from importing server credentials or their parent controllers, and lowers controller ceilings. The only allowed HR controller bridge is the existing lazy mount from staff.

New browser coverage verifies staff drafts across tabs, every HR section, club detail tabs, player challenge loading, and rejection of an incorrect private-club code on desktop and mobile. Existing checks cover real MFA login, CAPTCHA token handling, duplicate submissions, both booking venues, operations/results, receipts, failure recovery, reports, the shared staff calendar, themes, and responsive containment.

The local browser suite uses one worker because its tests share an MFA account: overlapping authentications produced missing-session and MFA foreign-key failures in the local GoTrue service. Sequential execution keeps real MFA and all access checks enabled rather than bypassing them. Future parallel execution should provision a separate authenticated account per worker.
